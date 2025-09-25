using System.Threading;
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
    private long _sequence;

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
        var sequence = Interlocked.Increment(ref _sequence);
        return new InstanceStatusResponse(
            sequence,
            _hostname,
            _startedAtUtc,
            now,
            now - _startedAtUtc,
            _probes.GetSnapshot(),
            _stress.GetSnapshot());
    }
}
