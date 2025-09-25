using System.Diagnostics;
using K8sDemoApp;
using K8sDemoApp.Models;
using Microsoft.AspNetCore.Http;

var builder = WebApplication.CreateSlimBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonSerializerContext.Default);
});

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<ProbeCoordinator>();
builder.Services.AddSingleton<StressCoordinator>();
builder.Services.AddSingleton<StatusService>();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/health/startup", (ProbeCoordinator probes) => EvaluateProbe(probes, ProbeType.Startup));
app.MapGet("/health/readiness", (ProbeCoordinator probes) => EvaluateProbe(probes, ProbeType.Readiness));
app.MapGet("/health/liveness", (ProbeCoordinator probes) => EvaluateProbe(probes, ProbeType.Liveness));

var api = app.MapGroup("/api");

api.MapGet("/status", (StatusService status) => Results.Ok(status.GetStatus()));

var probesApi = api.MapGroup("/probes");
probesApi.MapPost("/{probe}/down", (string probe, ScheduleDowntimeRequest request, ProbeCoordinator probes) =>
{
    if (!ProbeRoute.TryParse(probe, out var probeType))
    {
        return Results.BadRequest(new ApiError($"Unknown probe '{probe}'."));
    }

    if (!RequestValidators.TryGetDurationInMinutes(request.Minutes, 24 * 60, out var duration, out var error))
    {
        return Results.BadRequest(new ApiError(error));
    }

    var snapshot = probes.ScheduleDowntime(probeType, duration);
    return Results.Ok(snapshot);
});

probesApi.MapPost("/{probe}/up", (string probe, ProbeCoordinator probes) =>
{
    if (!ProbeRoute.TryParse(probe, out var probeType))
    {
        return Results.BadRequest(new ApiError($"Unknown probe '{probe}'."));
    }

    var snapshot = probes.Restore(probeType);
    return Results.Ok(snapshot);
});

var stressApi = api.MapGroup("/stress");

stressApi.MapPost("/cpu", (StressCpuRequest request, StressCoordinator stress) =>
{
    if (!RequestValidators.TryGetDurationInMinutes(request.Minutes, 60, out var duration, out var error))
    {
        return Results.BadRequest(new ApiError(error));
    }

    if (!RequestValidators.TryGetThreadCount(request.Threads, out var threads, out error))
    {
        return Results.BadRequest(new ApiError(error));
    }

    var result = stress.StartCpuStress(duration, threads);
    return result.Success
        ? Results.Ok(result.Status)
        : Results.BadRequest(new ApiError(result.Error ?? "Unable to start CPU workload."));
});

stressApi.MapDelete("/cpu", (StressCoordinator stress) => Results.Ok(stress.CancelCpuStress()));

stressApi.MapPost("/memory", (StressMemoryRequest request, StressCoordinator stress) =>
{
    if (!RequestValidators.TryGetDurationInMinutes(request.Minutes, 60, out var duration, out var error))
    {
        return Results.BadRequest(new ApiError(error));
    }

    if (!RequestValidators.TryGetMemoryTarget(request.TargetMegabytes, out var target, out error))
    {
        return Results.BadRequest(new ApiError(error));
    }

    var result = stress.StartMemoryStress(duration, target);
    return result.Success
        ? Results.Ok(result.Status)
        : Results.BadRequest(new ApiError(result.Error ?? "Unable to start memory workload."));
});

stressApi.MapDelete("/memory", (StressCoordinator stress) => Results.Ok(stress.CancelMemoryStress()));

app.Run();

static IResult EvaluateProbe(ProbeCoordinator probes, ProbeType type)
{
    var healthy = probes.IsHealthy(type);
    return healthy
        ? TypedResults.Json(new HealthPayload("ok"), AppJsonSerializerContext.Default.HealthPayload)
        : TypedResults.Json(new HealthPayload("down"), AppJsonSerializerContext.Default.HealthPayload, statusCode: StatusCodes.Status503ServiceUnavailable);
}

internal sealed class StatusService
{
    private readonly TimeProvider _timeProvider;
    private readonly ProbeCoordinator _probes;
    private readonly StressCoordinator _stress;
    private readonly DateTimeOffset _startedAtUtc;
    private readonly string _hostname;

    public StatusService(TimeProvider timeProvider, ProbeCoordinator probes, StressCoordinator stress)
    {
        _timeProvider = timeProvider;
        _probes = probes;
        _stress = stress;
        _startedAtUtc = timeProvider.GetUtcNow();
        _hostname = Environment.MachineName;
    }

    public InstanceStatusResponse GetStatus()
    {
        var now = _timeProvider.GetUtcNow();
        return new InstanceStatusResponse(
            _hostname,
            _startedAtUtc,
            now,
            now - _startedAtUtc,
            _probes.GetSnapshot(),
            _stress.GetSnapshot());
    }
}

internal sealed class ProbeCoordinator
{
    private readonly TimeProvider _timeProvider;
    private readonly Dictionary<ProbeType, ProbeState> _states;
    private readonly object _lock = new();

    public ProbeCoordinator(TimeProvider timeProvider)
    {
        _timeProvider = timeProvider;
        _states = Enum.GetValues<ProbeType>()
            .ToDictionary(static type => type, static type => new ProbeState(type));
    }

    public ProbeInfoDto ScheduleDowntime(ProbeType type, TimeSpan duration)
    {
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(duration, TimeSpan.Zero);

        lock (_lock)
        {
            var now = _timeProvider.GetUtcNow();
            var until = now.Add(duration);
            _states[type].DownUntilUtc = until;
            return ToDto(type, until);
        }
    }

    public ProbeInfoDto Restore(ProbeType type)
    {
        lock (_lock)
        {
            _states[type].DownUntilUtc = null;
            return ToDto(type, null);
        }
    }

    public bool IsHealthy(ProbeType type)
    {
        lock (_lock)
        {
            var now = _timeProvider.GetUtcNow();
            var state = _states[type];
            if (state.DownUntilUtc is { } until && until <= now)
            {
                state.DownUntilUtc = null;
            }

            return state.DownUntilUtc is null;
        }
    }

    public ProbeSnapshot GetSnapshot()
    {
        lock (_lock)
        {
            var now = _timeProvider.GetUtcNow();
            var startup = BuildDto(ProbeType.Startup, now);
            var readiness = BuildDto(ProbeType.Readiness, now);
            var liveness = BuildDto(ProbeType.Liveness, now);
            return new ProbeSnapshot(startup, readiness, liveness);
        }
    }

    private ProbeInfoDto BuildDto(ProbeType type, DateTimeOffset now)
    {
        var state = _states[type];
        if (state.DownUntilUtc is { } until && until <= now)
        {
            state.DownUntilUtc = null;
        }

        return ToDto(type, state.DownUntilUtc);
    }

    private static ProbeInfoDto ToDto(ProbeType type, DateTimeOffset? downUntilUtc)
    {
        return new ProbeInfoDto(ProbeRoute.ToSegment(type), downUntilUtc is null, downUntilUtc);
    }

    private sealed class ProbeState
    {
        public ProbeState(ProbeType type)
        {
            Type = type;
        }

        public ProbeType Type { get; }
        public DateTimeOffset? DownUntilUtc { get; set; }
    }
}

internal sealed class StressCoordinator
{
    private const int MaxMemoryMegabytes = 32_768;

    private readonly TimeProvider _timeProvider;
    private readonly object _lock = new();
    private CpuRun? _cpuRun;
    private MemoryRun? _memoryRun;
    private StressWorkloadStatus _cpuSnapshot = new("cpu", false, null, null, null, null, null, null);
    private StressWorkloadStatus _memorySnapshot = new("memory", false, null, null, null, null, null, null);

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

        lock (_lock)
        {
            StopCpuLocked(null);

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
            return StressStartResult.Successful(_cpuSnapshot);
        }
    }

    public StressWorkloadStatus CancelCpuStress()
    {
        lock (_lock)
        {
            StopCpuLocked(null);
            return _cpuSnapshot;
        }
    }

    public StressStartResult StartMemoryStress(TimeSpan duration, int megabytes)
    {
        if (megabytes <= 0)
        {
            return StressStartResult.Failure("Target megabytes must be greater than zero.", _memorySnapshot);
        }

        if (megabytes > MaxMemoryMegabytes)
        {
            return StressStartResult.Failure($"Target megabytes is capped at {MaxMemoryMegabytes} to protect the host.", _memorySnapshot);
        }

        lock (_lock)
        {
            StopMemoryLocked(null);

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
            return StressStartResult.Successful(_memorySnapshot);
        }
    }

    public StressWorkloadStatus CancelMemoryStress()
    {
        lock (_lock)
        {
            StopMemoryLocked(null);
            return _memorySnapshot;
        }
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
            lock (_lock)
            {
                if (ReferenceEquals(_cpuRun, run))
                {
                    StopCpuLocked(null);
                }
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
            lock (_lock)
            {
                if (ReferenceEquals(_memoryRun, run))
                {
                    StopMemoryLocked(null);
                }
            }
        }
    }

    private void StopCpuLocked(string? error)
    {
        if (_cpuRun is not { } run)
        {
            if (!string.IsNullOrEmpty(error))
            {
                _cpuSnapshot = _cpuSnapshot with { LastError = error, CompletedAtUtc = _timeProvider.GetUtcNow(), Active = false };
            }
            return;
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
    }

    private void StopMemoryLocked(string? error)
    {
        if (_memoryRun is not { } run)
        {
            if (!string.IsNullOrEmpty(error))
            {
                _memorySnapshot = _memorySnapshot with { LastError = error, CompletedAtUtc = _timeProvider.GetUtcNow(), Active = false };
            }
            return;
        }

        _memoryRun = null;
        run.Cancellation.Cancel();
        run.Blocks.Clear();
        GC.Collect();
        var completed = _timeProvider.GetUtcNow();
        _memorySnapshot = new StressWorkloadStatus("memory", false, run.StartedAtUtc, run.ExpectedCompletionUtc, completed, null, run.TargetMegabytes, error);
        run.Cancellation.Dispose();
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

internal sealed record HealthPayload(string Status);

internal static class ProbeRoute
{
    public static bool TryParse(string? value, out ProbeType type)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            var normalized = value.Trim().ToLowerInvariant();
            foreach (var candidate in Enum.GetValues<ProbeType>())
            {
                if (ToSegment(candidate) == normalized)
                {
                    type = candidate;
                    return true;
                }
            }
        }

        type = default;
        return false;
    }

    public static string ToSegment(ProbeType type) => type switch
    {
        ProbeType.Startup => "startup",
        ProbeType.Readiness => "readiness",
        ProbeType.Liveness => "liveness",
        _ => throw new UnreachableException(),
    };
}

internal static class RequestValidators
{
    public static bool TryGetDurationInMinutes(double minutes, double max, out TimeSpan duration, out string error)
    {
        if (double.IsNaN(minutes) || double.IsInfinity(minutes) || minutes <= 0)
        {
            duration = TimeSpan.Zero;
            error = "Minutes must be greater than zero.";
            return false;
        }

        if (minutes > max)
        {
            duration = TimeSpan.Zero;
            error = $"Minutes cannot exceed {max}.";
            return false;
        }

        duration = TimeSpan.FromMinutes(minutes);
        error = string.Empty;
        return true;
    }

    public static bool TryGetThreadCount(int? requested, out int threads, out string error)
    {
        threads = requested ?? Math.Clamp(Environment.ProcessorCount, 1, Environment.ProcessorCount * 2);
        if (threads <= 0)
        {
            error = "Threads must be greater than zero.";
            return false;
        }

        var max = Environment.ProcessorCount * 8;
        if (threads > max)
        {
            error = $"Threads cannot exceed {max}.";
            return false;
        }

        error = string.Empty;
        return true;
    }

    public static bool TryGetMemoryTarget(int requested, out int target, out string error)
    {
        if (requested <= 0)
        {
            target = 0;
            error = "Target megabytes must be greater than zero.";
            return false;
        }

        target = requested;
        error = string.Empty;
        return true;
    }
}

internal readonly record struct StressStartResult(bool Success, StressWorkloadStatus Status, string? Error)
{
    public static StressStartResult Successful(StressWorkloadStatus status) => new(true, status, null);
    public static StressStartResult Failure(string error, StressWorkloadStatus current) => new(false, current, error);
}
