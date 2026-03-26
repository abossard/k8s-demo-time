using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.Text;
using K8sDemoApp.Application.Probes;
using K8sDemoApp.Application.Stress;
using K8sDemoApp.Models;

namespace K8sDemoApp.Application.Metrics;

internal static class MetricsModule
{
    public static IServiceCollection AddMetricsModule(this IServiceCollection services)
    {
        services.AddSingleton<MetricsCollector>();
        return services;
    }

    public static WebApplication UseRequestMetrics(this WebApplication app)
    {
        var collector = app.Services.GetRequiredService<MetricsCollector>();

        app.Use(async (context, next) =>
        {
            var path = NormalizePath(context.Request.Path);

            if (string.Equals(path, "/metrics", StringComparison.OrdinalIgnoreCase))
            {
                await next(context);
                return;
            }

            var method = context.Request.Method;
            collector.IncrementActiveRequests();
            var startTimestamp = Stopwatch.GetTimestamp();

            try
            {
                await next(context);
            }
            finally
            {
                var elapsed = Stopwatch.GetElapsedTime(startTimestamp);
                var statusCode = context.Response.StatusCode;
                collector.DecrementActiveRequests();
                collector.RecordRequest(method, path, statusCode, elapsed.TotalSeconds);
            }
        });

        return app;
    }

    public static WebApplication MapMetricsEndpoints(this WebApplication app)
    {
        app.MapGet("/metrics", (
            MetricsCollector collector,
            IProbeScheduler probes,
            IStressSupervisor stress,
            TimeProvider timeProvider) =>
        {
            var body = BuildMetricsOutput(collector, probes, stress, timeProvider);
            return Results.Text(body, "text/plain; version=0.0.4; charset=utf-8");
        }).ExcludeFromDescription();

        return app;
    }

    private static string BuildMetricsOutput(
        MetricsCollector collector,
        IProbeScheduler probes,
        IStressSupervisor stress,
        TimeProvider timeProvider)
    {
        var sb = new StringBuilder(4096);

        WriteProcessMetrics(sb);
        WriteHttpMetrics(sb, collector);
        WriteAppMetrics(sb, probes, stress, timeProvider);

        return sb.ToString();
    }

    private static void WriteProcessMetrics(StringBuilder sb)
    {
        var process = Process.GetCurrentProcess();

        var cpuSeconds = process.TotalProcessorTime.TotalSeconds;
        sb.AppendLine("# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds.");
        sb.AppendLine("# TYPE process_cpu_seconds_total counter");
        sb.Append("process_cpu_seconds_total ");
        sb.AppendLine(FormatDouble(cpuSeconds));

        var workingSet = process.WorkingSet64;
        sb.AppendLine("# HELP process_resident_memory_bytes Resident memory size in bytes.");
        sb.AppendLine("# TYPE process_resident_memory_bytes gauge");
        sb.Append("process_resident_memory_bytes ");
        sb.AppendLine(FormatDouble(workingSet));

        var virtualMemory = process.VirtualMemorySize64;
        sb.AppendLine("# HELP process_virtual_memory_bytes Virtual memory size in bytes.");
        sb.AppendLine("# TYPE process_virtual_memory_bytes gauge");
        sb.Append("process_virtual_memory_bytes ");
        sb.AppendLine(FormatDouble(virtualMemory));

        var startTime = new DateTimeOffset(process.StartTime.ToUniversalTime(), TimeSpan.Zero);
        var startTimeUnix = startTime.ToUnixTimeMilliseconds() / 1000.0;
        sb.AppendLine("# HELP process_start_time_seconds Start time of the process since unix epoch in seconds.");
        sb.AppendLine("# TYPE process_start_time_seconds gauge");
        sb.Append("process_start_time_seconds ");
        sb.AppendLine(FormatDouble(startTimeUnix));
    }

    private static void WriteHttpMetrics(StringBuilder sb, MetricsCollector collector)
    {
        sb.AppendLine("# HELP http_requests_total Total number of HTTP requests.");
        sb.AppendLine("# TYPE http_requests_total counter");
        foreach (var entry in collector.GetRequestCounts())
        {
            sb.Append("http_requests_total{method=\"");
            sb.Append(entry.Key.Method);
            sb.Append("\",path=\"");
            sb.Append(EscapeLabelValue(entry.Key.Path));
            sb.Append("\",status_code=\"");
            sb.Append(entry.Key.StatusCode);
            sb.Append("\"} ");
            sb.AppendLine(entry.Value.ToString(CultureInfo.InvariantCulture));
        }

        sb.AppendLine("# HELP http_request_duration_seconds_sum Total duration of HTTP requests in seconds.");
        sb.AppendLine("# TYPE http_request_duration_seconds_sum counter");
        sb.AppendLine("# HELP http_request_duration_seconds_count Total count of HTTP requests for duration tracking.");
        sb.AppendLine("# TYPE http_request_duration_seconds_count counter");
        foreach (var entry in collector.GetDurationStats())
        {
            sb.Append("http_request_duration_seconds_sum{method=\"");
            sb.Append(entry.Key.Method);
            sb.Append("\",path=\"");
            sb.Append(EscapeLabelValue(entry.Key.Path));
            sb.Append("\"} ");
            sb.AppendLine(FormatDouble(entry.Value.TotalSeconds));

            sb.Append("http_request_duration_seconds_count{method=\"");
            sb.Append(entry.Key.Method);
            sb.Append("\",path=\"");
            sb.Append(EscapeLabelValue(entry.Key.Path));
            sb.Append("\"} ");
            sb.AppendLine(entry.Value.Count.ToString(CultureInfo.InvariantCulture));
        }

        sb.AppendLine("# HELP http_server_active_requests Number of active HTTP requests currently being processed.");
        sb.AppendLine("# TYPE http_server_active_requests gauge");
        sb.Append("http_server_active_requests ");
        sb.AppendLine(collector.ActiveRequests.ToString(CultureInfo.InvariantCulture));
    }

    private static void WriteAppMetrics(
        StringBuilder sb,
        IProbeScheduler probes,
        IStressSupervisor stress,
        TimeProvider timeProvider)
    {
        var snapshot = probes.GetSnapshot();

        sb.AppendLine("# HELP k8s_demo_probe_healthy Whether a Kubernetes probe is healthy (1) or unhealthy (0).");
        sb.AppendLine("# TYPE k8s_demo_probe_healthy gauge");
        sb.Append("k8s_demo_probe_healthy{probe=\"startup\"} ");
        sb.AppendLine(snapshot.Startup.Healthy ? "1" : "0");
        sb.Append("k8s_demo_probe_healthy{probe=\"readiness\"} ");
        sb.AppendLine(snapshot.Readiness.Healthy ? "1" : "0");
        sb.Append("k8s_demo_probe_healthy{probe=\"liveness\"} ");
        sb.AppendLine(snapshot.Liveness.Healthy ? "1" : "0");

        var stressSnapshot = stress.GetSnapshot();

        sb.AppendLine("# HELP k8s_demo_stress_cpu_active Whether CPU stress is currently active (1) or inactive (0).");
        sb.AppendLine("# TYPE k8s_demo_stress_cpu_active gauge");
        sb.Append("k8s_demo_stress_cpu_active ");
        sb.AppendLine(stressSnapshot.Cpu.Active ? "1" : "0");

        sb.AppendLine("# HELP k8s_demo_stress_memory_active Whether memory stress is currently active (1) or inactive (0).");
        sb.AppendLine("# TYPE k8s_demo_stress_memory_active gauge");
        sb.Append("k8s_demo_stress_memory_active ");
        sb.AppendLine(stressSnapshot.Memory.Active ? "1" : "0");

        sb.AppendLine("# HELP k8s_demo_stress_memory_target_bytes Target memory allocation for memory stress in bytes.");
        sb.AppendLine("# TYPE k8s_demo_stress_memory_target_bytes gauge");
        sb.Append("k8s_demo_stress_memory_target_bytes ");
        var memoryTargetBytes = stressSnapshot.Memory.Active && stressSnapshot.Memory.TargetMegabytes.HasValue
            ? (long)stressSnapshot.Memory.TargetMegabytes.Value * 1024 * 1024
            : 0;
        sb.AppendLine(memoryTargetBytes.ToString(CultureInfo.InvariantCulture));

        sb.AppendLine("# HELP k8s_demo_uptime_seconds Time in seconds since the application started.");
        sb.AppendLine("# TYPE k8s_demo_uptime_seconds gauge");
        sb.Append("k8s_demo_uptime_seconds ");
        var process = Process.GetCurrentProcess();
        var startTime = new DateTimeOffset(process.StartTime.ToUniversalTime(), TimeSpan.Zero);
        var uptime = timeProvider.GetUtcNow() - startTime;
        sb.AppendLine(FormatDouble(uptime.TotalSeconds));
    }

    /// <summary>
    /// Normalizes a request path to the first two segments to limit cardinality.
    /// E.g. /api/stress/cpu/start → /api/stress, /health/startup → /health/startup
    /// </summary>
    internal static string NormalizePath(string? path)
    {
        if (string.IsNullOrEmpty(path) || path == "/")
        {
            return "/";
        }

        var span = path.AsSpan();
        if (span[0] != '/')
        {
            span = string.Concat("/", path).AsSpan();
        }

        // Find the second '/' after the first
        var secondSlash = span.Slice(1).IndexOf('/');
        if (secondSlash < 0)
        {
            return span.ToString();
        }

        secondSlash += 1; // adjust for the Slice(1) offset

        // Find the third '/'
        var remaining = span.Slice(secondSlash + 1);
        var thirdSlash = remaining.IndexOf('/');
        if (thirdSlash < 0)
        {
            return span.ToString();
        }

        return span.Slice(0, secondSlash + 1 + thirdSlash).ToString();
    }

    private static string FormatDouble(double value)
    {
        return value.ToString("G", CultureInfo.InvariantCulture);
    }

    private static string EscapeLabelValue(string value)
    {
        return value
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\n", "\\n");
    }
}

internal readonly struct RequestKey : IEquatable<RequestKey>
{
    public RequestKey(string method, string path, int statusCode)
    {
        Method = method;
        Path = path;
        StatusCode = statusCode;
    }

    public string Method { get; }
    public string Path { get; }
    public int StatusCode { get; }

    public bool Equals(RequestKey other) =>
        string.Equals(Method, other.Method, StringComparison.Ordinal)
        && string.Equals(Path, other.Path, StringComparison.Ordinal)
        && StatusCode == other.StatusCode;

    public override bool Equals(object? obj) => obj is RequestKey other && Equals(other);

    public override int GetHashCode() => HashCode.Combine(
        StringComparer.Ordinal.GetHashCode(Method),
        StringComparer.Ordinal.GetHashCode(Path),
        StatusCode);
}

internal readonly struct DurationKey : IEquatable<DurationKey>
{
    public DurationKey(string method, string path)
    {
        Method = method;
        Path = path;
    }

    public string Method { get; }
    public string Path { get; }

    public bool Equals(DurationKey other) =>
        string.Equals(Method, other.Method, StringComparison.Ordinal)
        && string.Equals(Path, other.Path, StringComparison.Ordinal);

    public override bool Equals(object? obj) => obj is DurationKey other && Equals(other);

    public override int GetHashCode() => HashCode.Combine(
        StringComparer.Ordinal.GetHashCode(Method),
        StringComparer.Ordinal.GetHashCode(Path));
}

internal sealed class DurationAccumulator
{
    private long _count;
    private double _totalSeconds;
    private readonly object _lock = new();

    public long Count => Interlocked.Read(ref _count);

    public double TotalSeconds
    {
        get
        {
            lock (_lock)
            {
                return _totalSeconds;
            }
        }
    }

    public void Record(double seconds)
    {
        lock (_lock)
        {
            _totalSeconds += seconds;
        }

        Interlocked.Increment(ref _count);
    }
}

internal sealed class MetricsCollector
{
    private readonly ConcurrentDictionary<RequestKey, long> _requestCounts = new();
    private readonly ConcurrentDictionary<DurationKey, DurationAccumulator> _durations = new();
    private long _activeRequests;

    public long ActiveRequests => Interlocked.Read(ref _activeRequests);

    public void IncrementActiveRequests() => Interlocked.Increment(ref _activeRequests);

    public void DecrementActiveRequests() => Interlocked.Decrement(ref _activeRequests);

    public void RecordRequest(string method, string path, int statusCode, double durationSeconds)
    {
        var requestKey = new RequestKey(method, path, statusCode);
        _requestCounts.AddOrUpdate(requestKey, 1, static (_, count) => count + 1);

        var durationKey = new DurationKey(method, path);
        var accumulator = _durations.GetOrAdd(durationKey, static _ => new DurationAccumulator());
        accumulator.Record(durationSeconds);
    }

    public IEnumerable<KeyValuePair<RequestKey, long>> GetRequestCounts() => _requestCounts;

    public IEnumerable<KeyValuePair<DurationKey, DurationAccumulator>> GetDurationStats() => _durations;
}
