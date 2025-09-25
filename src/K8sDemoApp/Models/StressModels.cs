namespace K8sDemoApp.Models;

public sealed record StressWorkloadStatus(
    string Kind,
    bool Active,
    DateTimeOffset? StartedAtUtc,
    DateTimeOffset? ExpectedCompletionUtc,
    DateTimeOffset? CompletedAtUtc,
    int? ThreadCount,
    int? TargetMegabytes,
    string? LastError);

public sealed record StressSnapshot(StressWorkloadStatus Cpu, StressWorkloadStatus Memory);
