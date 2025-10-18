namespace K8sDemoApp.Models;

public sealed record ScheduleDowntimeRequest(double Minutes, bool? BroadcastToAll);

public sealed record StressCpuRequest(double Minutes, int? Threads, bool? BroadcastToAll);

public sealed record StressMemoryRequest(double Minutes, int TargetMegabytes, bool? BroadcastToAll);

public sealed record FreezeRequest(double Minutes, bool? BroadcastToAll);
