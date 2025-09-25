namespace K8sDemoApp.Models;

public sealed record ScheduleDowntimeRequest(double Minutes);

public sealed record StressCpuRequest(double Minutes, int? Threads);

public sealed record StressMemoryRequest(double Minutes, int TargetMegabytes);
