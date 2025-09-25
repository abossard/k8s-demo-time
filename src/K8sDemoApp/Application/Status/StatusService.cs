using K8sDemoApp.Application.Probes;
using K8sDemoApp.Application.Stress;
using K8sDemoApp.Models;

namespace K8sDemoApp.Application.Status;

internal sealed class StatusService
{
    private readonly TimeProvider _timeProvider;
    private readonly IProbeScheduler _probes;
    private readonly IStressSupervisor _stress;
    private readonly DateTimeOffset _startedAtUtc;
    private readonly string _hostname;

    public StatusService(TimeProvider timeProvider, IProbeScheduler probes, IStressSupervisor stress)
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
