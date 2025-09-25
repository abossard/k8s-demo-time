namespace K8sDemoApp.Models;

public sealed record InstanceStatusResponse(
    string Hostname,
    DateTimeOffset StartedAtUtc,
    DateTimeOffset CurrentTimeUtc,
    TimeSpan Uptime,
    ProbeSnapshot Probes,
    StressSnapshot Stress);
