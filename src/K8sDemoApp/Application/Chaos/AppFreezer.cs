using System;
using System.Threading;
using System.Threading.Tasks;

namespace K8sDemoApp.Application.Chaos;

internal interface IAppFreezer
{
    void Freeze(TimeSpan duration);
    ValueTask WaitIfFrozenAsync(CancellationToken cancellationToken);
}

internal sealed class AppFreezer : IAppFreezer
{
    private readonly TimeProvider _timeProvider;
    private readonly object _sync = new();
    private DateTimeOffset? _frozenUntilUtc;

    public AppFreezer(TimeProvider timeProvider)
    {
        _timeProvider = timeProvider;
    }

    public void Freeze(TimeSpan duration)
    {
        if (duration <= TimeSpan.Zero)
        {
            throw new ArgumentOutOfRangeException(nameof(duration));
        }

        var now = _timeProvider.GetUtcNow();
        var requestedUntil = now + duration;

        lock (_sync)
        {
            if (_frozenUntilUtc is null || _frozenUntilUtc < requestedUntil)
            {
                _frozenUntilUtc = requestedUntil;
            }
        }
    }

    public async ValueTask WaitIfFrozenAsync(CancellationToken cancellationToken)
    {
        while (true)
        {
            DateTimeOffset? frozenUntil;
            lock (_sync)
            {
                frozenUntil = _frozenUntilUtc;
            }

            if (frozenUntil is null)
            {
                return;
            }

            var now = _timeProvider.GetUtcNow();
            if (frozenUntil <= now)
            {
                ClearIfExpired(now);
                continue;
            }

            var delay = frozenUntil.Value - now;
            await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
            ClearIfExpired(_timeProvider.GetUtcNow());
        }
    }

    private void ClearIfExpired(DateTimeOffset now)
    {
        lock (_sync)
        {
            if (_frozenUntilUtc is not null && _frozenUntilUtc <= now)
            {
                _frozenUntilUtc = null;
            }
        }
    }
}
