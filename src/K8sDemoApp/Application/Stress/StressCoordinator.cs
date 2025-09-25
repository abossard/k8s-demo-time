namespace K8sDemoApp.Application.Stress;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using K8sDemoApp.Models;

internal interface IStressSupervisor
{
    event Action StatusChanged;
    StressStartResult StartCpuStress(TimeSpan duration, int threads);
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

    public StressStartResult StartCpuStress(TimeSpan duration, int threads)
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
            var cts = new CancellationTokenSource();
            var token = cts.Token;
            var tasks = new Task[threads];

            for (var i = 0; i < threads; i++)
            {
                tasks[i] = Task.Factory.StartNew(() => CpuWorker(token), token, TaskCreationOptions.LongRunning, TaskScheduler.Default);
            }

            var run = new CpuRun(now, expected, threads, cts, tasks);
            _cpuRun = run;
            _cpuSnapshot = new StressWorkloadStatus("cpu", true, now, expected, null, threads, null, null);
            _ = MonitorCpuAsync(run, duration);
            notify = true;
            result = StressStartResult.Successful(_cpuSnapshot);
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
            }
            catch (OutOfMemoryException)
            {
                blocks.Clear();
                GC.Collect();
                return StressStartResult.Failure("Unable to allocate requested memory. Try a smaller value.", _memorySnapshot);
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
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.WhenAll(run.Tasks).ConfigureAwait(false);
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
        public CpuRun(DateTimeOffset startedAtUtc, DateTimeOffset expectedCompletionUtc, int threadCount, CancellationTokenSource cancellation, Task[] tasks)
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
        public Task[] Tasks { get; }
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
