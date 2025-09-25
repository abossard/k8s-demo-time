using K8sDemoApp.Application.Common;
using K8sDemoApp.Models;

namespace K8sDemoApp.Application.Probes;

internal interface IProbeScheduler
{
    ProbeInfoDto ScheduleDowntime(ProbeType type, TimeSpan duration);
    ProbeInfoDto Restore(ProbeType type);
    bool IsHealthy(ProbeType type);
    ProbeSnapshot GetSnapshot();
}

internal sealed class ProbeStateStore : IProbeScheduler
{
    private readonly TimeProvider _timeProvider;
    private readonly Dictionary<ProbeType, ProbeState> _states;
    private readonly object _lock = new();

    public ProbeStateStore(TimeProvider timeProvider)
        : this(timeProvider, TimeSpan.Zero)
    {
    }

    public ProbeStateStore(TimeProvider timeProvider, TimeSpan startupHoldDuration)
    {
        _timeProvider = timeProvider;
        _states = Enum.GetValues<ProbeType>()
            .ToDictionary(static type => type, static type => new ProbeState(type));

        if (startupHoldDuration > TimeSpan.Zero)
        {
            var holdUntil = _timeProvider.GetUtcNow().Add(startupHoldDuration);
            _states[ProbeType.Startup].DownUntilUtc = holdUntil;
        }
    }

    public ProbeInfoDto ScheduleDowntime(ProbeType type, TimeSpan duration)
    {
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(duration, TimeSpan.Zero);

        lock (_lock)
        {
            var now = _timeProvider.GetUtcNow();
            var until = now.Add(duration);
            var state = _states[type];
            state.DownUntilUtc = until;
            return ToDto(state);
        }
    }

    public ProbeInfoDto Restore(ProbeType type)
    {
        lock (_lock)
        {
            var state = _states[type];
            state.DownUntilUtc = null;
            return ToDto(state);
        }
    }

    public bool IsHealthy(ProbeType type)
    {
        lock (_lock)
        {
            var now = _timeProvider.GetUtcNow();
            var state = _states[type];
            state.RegisterCall(now);
            if (state.DownUntilUtc is { } until && until <= now)
            {
                state.DownUntilUtc = null;
            }

            return state.DownUntilUtc is null;
        }
    }

    public ProbeSnapshot GetSnapshot()
    {
        lock (_lock)
        {
            var now = _timeProvider.GetUtcNow();
            var startup = BuildDto(ProbeType.Startup, now);
            var readiness = BuildDto(ProbeType.Readiness, now);
            var liveness = BuildDto(ProbeType.Liveness, now);
            return new ProbeSnapshot(startup, readiness, liveness);
        }
    }

    private ProbeInfoDto BuildDto(ProbeType type, DateTimeOffset now)
    {
        var state = _states[type];
        if (state.DownUntilUtc is { } until && until <= now)
        {
            state.DownUntilUtc = null;
        }

        return ToDto(state);
    }

    private static ProbeInfoDto ToDto(ProbeState state)
    {
        return new ProbeInfoDto(
            ProbeRoute.ToSegment(state.Type),
            state.DownUntilUtc is null,
            state.DownUntilUtc,
            state.CallCount,
            state.LastCalledUtc);
    }

    private sealed class ProbeState
    {
        public ProbeState(ProbeType type)
        {
            Type = type;
        }

        public ProbeType Type { get; }
        public DateTimeOffset? DownUntilUtc { get; set; }
        public long CallCount { get; private set; }
        public DateTimeOffset? LastCalledUtc { get; private set; }

        public void RegisterCall(DateTimeOffset now)
        {
            CallCount++;
            LastCalledUtc = now;
        }
    }
}
