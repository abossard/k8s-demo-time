namespace K8sDemoApp.Models;

public enum ProbeType
{
    Startup,
    Readiness,
    Liveness,
}

public sealed record ProbeInfoDto(string Name, bool Healthy, DateTimeOffset? DownUntilUtc);

public sealed record ProbeSnapshot(ProbeInfoDto Startup, ProbeInfoDto Readiness, ProbeInfoDto Liveness);
