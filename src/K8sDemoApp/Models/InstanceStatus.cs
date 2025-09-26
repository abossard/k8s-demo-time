using System.Collections.Generic;

namespace K8sDemoApp.Models;

public sealed record InstanceStatusResponse(
    long Sequence,
    string Hostname,
    DateTimeOffset StartedAtUtc,
    DateTimeOffset CurrentTimeUtc,
    TimeSpan Uptime,
    InstanceEnvironmentInfo Environment,
    InstanceResourcesInfo Resources,
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

public sealed record InstanceResourcesInfo(
    ResourceCapacity Requests,
    ResourceCapacity Limits,
    InstanceResourceUsage Usage);

public sealed record ResourceCapacity(
    string? Cpu,
    string? Memory);

public sealed record InstanceResourceUsage(
    double CpuMillicoresAverageLastWindow,
    double CpuPercentAverageLastWindow,
    long WorkingSetBytes,
    long ManagedMemoryBytes);
