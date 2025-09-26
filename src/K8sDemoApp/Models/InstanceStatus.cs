using System.Collections.Generic;

namespace K8sDemoApp.Models;

public sealed record InstanceStatusResponse(
    long Sequence,
    string Hostname,
    DateTimeOffset StartedAtUtc,
    DateTimeOffset CurrentTimeUtc,
    TimeSpan Uptime,
    InstanceEnvironmentInfo Environment,
    ProbeSnapshot Probes,
    StressSnapshot Stress);

public sealed record InstanceEnvironmentInfo(
    IReadOnlyList<string> IpAddresses,
    string? PodName,
    string? PodNamespace,
    string? PodUid,
    string? PodIp,
    string? ServiceAccountName,
    string? NodeName,
    string? NodeIp,
    string? ClusterName,
    string? ClusterDomain);
