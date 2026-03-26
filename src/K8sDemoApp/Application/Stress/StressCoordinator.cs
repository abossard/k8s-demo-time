namespace K8sDemoApp.Application.Stress;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using K8sDemoApp.Models;

internal interface IStressSupervisor
{
    event Action StatusChanged;
    StressStartResult StartCpuStress(TimeSpan duration, int threads, int rampSeconds = 0);
    StressWorkloadStatus CancelCpuStress();
    StressStartResult StartMemoryStress(TimeSpan duration, int megabytes);
    StressWorkloadStatus CancelMemoryStress();
    StressSnapshot GetSnapshot();
}

internal sealed class StressCoordinator : IStressSupervisor
{
    private readonly TimeProvider _timeProvider;
    private readonly object _lock = new();
    private CpuRun? _cpuRun;
    private MemoryRun? _memoryRun;
    private StressWorkloadStatus _cpuSnapshot = new("cpu", false, null, null, null, null, null, null);
    private StressWorkloadStatus _memorySnapshot = new("memory", false, null, null, null, null, null, null);

    public event Action? StatusChanged;

    public StressCoordinator(TimeProvider timeProvider)
    {
        _timeProvider = timeProvider;
    }

    public StressStartResult StartCpuStress(TimeSpan duration, int threads, int rampSeconds = 0)
    {
        if (threads <= 0)
        {
            return StressStartResult.Failure("Thread count must be greater than zero.", _cpuSnapshot);
        }

        if (duration <= TimeSpan.Zero)
        {
            return StressStartResult.Failure("Duration must be greater than zero.", _cpuSnapshot);
        }

        var notify = false;
        StressStartResult result;
        lock (_lock)
        {
            notify |= StopCpuLocked(null);

            var now = _timeProvider.GetUtcNow();
            var expected = now.Add(duration);
            CancellationTokenSource? cts = null;

            try
            {
                cts = new CancellationTokenSource();
                var token = cts.Token;
                var initialThreads = rampSeconds > 0 && threads > 1 ? 1 : threads;
                var tasks = new List<Task>(threads);

                for (var i = 0; i < initialThreads; i++)
                {
                    tasks.Add(Task.Factory.StartNew(() => CpuWorker(token), token, TaskCreationOptions.LongRunning, TaskScheduler.Default));
                }

                var run = new CpuRun(now, expected, threads, cts, tasks);
                _cpuRun = run;
                _cpuSnapshot = new StressWorkloadStatus("cpu", true, now, expected, null, initialThreads, null, null);

                if (rampSeconds > 0 && threads > initialThreads)
                {
                    _ = RampCpuThreadsAsync(run, initialThreads, threads, rampSeconds);
                }

                _ = MonitorCpuAsync(run, duration);
                notify = true;
                result = StressStartResult.Successful(_cpuSnapshot);
            }
            catch (Exception ex)
            {
                cts?.Cancel();
                cts?.Dispose();

                var message = $"Failed to start CPU stress: {ex.Message}";
                notify |= StopCpuLocked(message);
                result = StressStartResult.Failure(message, _cpuSnapshot);
            }
        }

        if (notify)
        {
            OnStatusChanged();
        }

        return result;
    }

    public StressWorkloadStatus CancelCpuStress()
    {
        var notify = false;
        StressWorkloadStatus snapshot;
        lock (_lock)
        {
            notify = StopCpuLocked(null);
            snapshot = _cpuSnapshot;
        }

        if (notify)
        {
            OnStatusChanged();
        }

        return snapshot;
    }

    public StressStartResult StartMemoryStress(TimeSpan duration, int megabytes)
    {
        if (megabytes <= 0)
        {
            return StressStartResult.Failure("Target megabytes must be greater than zero.", _memorySnapshot);
        }

        if (duration <= TimeSpan.Zero)
        {
            return StressStartResult.Failure("Duration must be greater than zero.", _memorySnapshot);
        }

        var notify = false;
        StressStartResult result;
        lock (_lock)
        {
            notify |= StopMemoryLocked(null);

            var blocks = new List<byte[]>(megabytes);
            try
            {
                const int megabyte = 1024 * 1024;
                for (var i = 0; i < megabytes; i++)
                {
                    var buffer = GC.AllocateUninitializedArray<byte>(megabyte);
                    TouchPages(buffer);
                    blocks.Add(buffer);
                }

                var now = _timeProvider.GetUtcNow();
                var expected = now.Add(duration);
                var cts = new CancellationTokenSource();
                var run = new MemoryRun(now, expected, megabytes, cts, blocks);
                _memoryRun = run;
                _memorySnapshot = new StressWorkloadStatus("memory", true, now, expected, null, null, megabytes, null);
                _ = MonitorMemoryAsync(run, duration);
                notify = true;
                result = StressStartResult.Successful(_memorySnapshot);
            }
            catch (OutOfMemoryException)
            {
                blocks.Clear();
                GC.Collect();
                const string message = "Unable to allocate requested memory. Try a smaller value.";
                notify |= StopMemoryLocked(message);
                result = StressStartResult.Failure(message, _memorySnapshot);
            }
            catch (Exception ex)
            {
                blocks.Clear();
                GC.Collect();
                var message = $"Failed to start memory stress: {ex.Message}";
                notify |= StopMemoryLocked(message);
                result = StressStartResult.Failure(message, _memorySnapshot);
            }
        }

        if (notify)
        {
            OnStatusChanged();
        }

        return result;
    }

    public StressWorkloadStatus CancelMemoryStress()
    {
        var notify = false;
        StressWorkloadStatus snapshot;
        lock (_lock)
        {
            notify = StopMemoryLocked(null);
            snapshot = _memorySnapshot;
        }

        if (notify)
        {
            OnStatusChanged();
        }

        return snapshot;
    }

    public StressSnapshot GetSnapshot()
    {
        lock (_lock)
        {
            return new StressSnapshot(_cpuSnapshot, _memorySnapshot);
        }
    }

    private async Task RampCpuThreadsAsync(CpuRun run, int currentThreads, int targetThreads, int rampSeconds)
    {
        var threadsToAdd = targetThreads - currentThreads;
        if (threadsToAdd <= 0) return;

        var intervalMs = (int)(rampSeconds * 1000.0 / threadsToAdd);
        intervalMs = Math.Max(intervalMs, 100);

        for (var i = 0; i < threadsToAdd; i++)
        {
            try
            {
                await Task.Delay(intervalMs, run.Cancellation.Token).ConfigureAwait(false);
            }
            catch (TaskCanceledException) { return; }

            lock (_lock)
            {
                if (!ReferenceEquals(_cpuRun, run)) return;
                var task = Task.Factory.StartNew(() => CpuWorker(run.Cancellation.Token), run.Cancellation.Token, TaskCreationOptions.LongRunning, TaskScheduler.Default);
                run.Tasks.Add(task);
                _cpuSnapshot = new StressWorkloadStatus("cpu", true, run.StartedAtUtc, run.ExpectedCompletionUtc, null, currentThreads + i + 1, null, null);
            }

            OnStatusChanged();
        }
    }

    private async Task MonitorCpuAsync(CpuRun run, TimeSpan duration)
    {
        try
        {
            await Task.Delay(duration, run.Cancellation.Token).ConfigureAwait(false);
        }
        catch (TaskCanceledException)
        {
        }
        finally
        {
            var notify = false;
            lock (_lock)
            {
                if (ReferenceEquals(_cpuRun, run))
                {
                    notify = StopCpuLocked(null);
                }
            }

            if (notify)
            {
                OnStatusChanged();
            }
        }
    }

    private async Task MonitorMemoryAsync(MemoryRun run, TimeSpan duration)
    {
        try
        {
            await Task.Delay(duration, run.Cancellation.Token).ConfigureAwait(false);
        }
        catch (TaskCanceledException)
        {
        }
        finally
        {
            var notify = false;
            lock (_lock)
            {
                if (ReferenceEquals(_memoryRun, run))
                {
                    notify = StopMemoryLocked(null);
                }
            }

            if (notify)
            {
                OnStatusChanged();
            }
        }
    }

    private async Task RampCpuAsync(CpuRun run, int currentThreads, int targetThreads, int rampSeconds)
    {
        var remaining = targetThreads - currentThreads;
        if (remaining <= 0) return;

        var intervalMs = (rampSeconds * 1000.0) / remaining;
        var token = run.Cancellation.Token;

        for (var i = 0; i < remaining; i++)
        {
            try
            {
                await Task.Delay(TimeSpan.FromMilliseconds(intervalMs), token).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                return;
            }

            var notify = false;
            lock (_lock)
            {
                if (!ReferenceEquals(_cpuRun, run)) return;

                var task = Task.Factory.StartNew(() => CpuWorker(token), token, TaskCreationOptions.LongRunning, TaskScheduler.Default);
                run.Tasks.Add(task);
                var newCount = currentThreads + i + 1;
                _cpuSnapshot = _cpuSnapshot with { ThreadCount = newCount };
                notify = true;
            }

            if (notify)
            {
                OnStatusChanged();
            }
        }
    }

    private bool StopCpuLocked(string? error)
    {
        var changed = false;
        if (_cpuRun is not { } run)
        {
            if (!string.IsNullOrEmpty(error))
            {
                _cpuSnapshot = _cpuSnapshot with
                {
                    LastError = error,
                    CompletedAtUtc = _timeProvider.GetUtcNow(),
                    Active = false,
                };
                changed = true;
            }
            return changed;
        }

        _cpuRun = null;
        run.Cancellation.Cancel();
        var completed = _timeProvider.GetUtcNow();
        _cpuSnapshot = new StressWorkloadStatus("cpu", false, run.StartedAtUtc, run.ExpectedCompletionUtc, completed, run.ThreadCount, null, error);
        var tasksCopy = run.Tasks.ToArray();
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.WhenAll(tasksCopy).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
            }
            catch (AggregateException aggregate) when (aggregate.InnerExceptions.All(static e => e is OperationCanceledException))
            {
            }
            finally
            {
                run.Cancellation.Dispose();
            }
        });
        return true;
    }

    private bool StopMemoryLocked(string? error)
    {
        var changed = false;
        if (_memoryRun is not { } run)
        {
            if (!string.IsNullOrEmpty(error))
            {
                _memorySnapshot = _memorySnapshot with
                {
                    LastError = error,
                    CompletedAtUtc = _timeProvider.GetUtcNow(),
                    Active = false,
                };
                changed = true;
            }
            return changed;
        }

        _memoryRun = null;
        run.Cancellation.Cancel();
        run.Blocks.Clear();
        GC.Collect();
        var completed = _timeProvider.GetUtcNow();
        _memorySnapshot = new StressWorkloadStatus("memory", false, run.StartedAtUtc, run.ExpectedCompletionUtc, completed, null, run.TargetMegabytes, error);
        run.Cancellation.Dispose();
        return true;
    }

    private void OnStatusChanged()
    {
        StatusChanged?.Invoke();
    }

    private static void CpuWorker(CancellationToken token)
    {
        Span<double> buffer = stackalloc double[8];
        var value = 0.0;
        while (!token.IsCancellationRequested)
        {
            for (var i = 0; i < buffer.Length; i++)
            {
                value = Math.Sqrt(value + i + 1);
                buffer[i] = value;
            }

            if (value > 1_000_000)
            {
                value = 0;
            }
        }
    }

    private static void TouchPages(byte[] buffer)
    {
        if (buffer.Length == 0)
        {
            return;
        }

        const int pageSize = 4096;
        for (var i = 0; i < buffer.Length; i += pageSize)
        {
            buffer[i] = 0x1;
        }

        buffer[^1] = 0x1;
    }

    private sealed class CpuRun
    {
        public CpuRun(DateTimeOffset startedAtUtc, DateTimeOffset expectedCompletionUtc, int threadCount, CancellationTokenSource cancellation, List<Task> tasks)
        {
            StartedAtUtc = startedAtUtc;
            ExpectedCompletionUtc = expectedCompletionUtc;
            ThreadCount = threadCount;
            Cancellation = cancellation;
            Tasks = tasks;
        }

        public DateTimeOffset StartedAtUtc { get; }
        public DateTimeOffset ExpectedCompletionUtc { get; }
        public int ThreadCount { get; }
        public CancellationTokenSource Cancellation { get; }
        public List<Task> Tasks { get; }
    }

    private sealed class MemoryRun
    {
        public MemoryRun(DateTimeOffset startedAtUtc, DateTimeOffset expectedCompletionUtc, int targetMegabytes, CancellationTokenSource cancellation, List<byte[]> blocks)
        {
            StartedAtUtc = startedAtUtc;
            ExpectedCompletionUtc = expectedCompletionUtc;
            TargetMegabytes = targetMegabytes;
            Cancellation = cancellation;
            Blocks = blocks;
        }

        public DateTimeOffset StartedAtUtc { get; }
        public DateTimeOffset ExpectedCompletionUtc { get; }
        public int TargetMegabytes { get; }
        public CancellationTokenSource Cancellation { get; }
        public List<byte[]> Blocks { get; }
    }
}
