using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;

namespace K8sDemoApp.Application.Status;

internal sealed class StatusHeartbeatService : BackgroundService
{
    private static readonly TimeSpan PublishInterval = TimeSpan.FromSeconds(5);
    private readonly IStatusStream _statusStream;

    public StatusHeartbeatService(IStatusStream statusStream)
    {
        _statusStream = statusStream;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(PublishInterval);

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false))
            {
                _statusStream.Publish();
            }
        }
        catch (OperationCanceledException)
        {
        }
    }
}
