using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Channels;
using K8sDemoApp.Application.Stress;
using K8sDemoApp.Models;

namespace K8sDemoApp.Application.Status;

internal interface IStatusStream
{
    IAsyncEnumerable<InstanceStatusResponse> SubscribeAsync(CancellationToken cancellationToken);
    void Publish();
}

internal sealed class StatusStream : IStatusStream
{
    private readonly StatusService _statusService;
    private readonly ConcurrentDictionary<long, Channel<InstanceStatusResponse>> _subscribers = new();
    private readonly object _publishLock = new();
    private long _nextId;

    public StatusStream(StatusService statusService, IStressSupervisor stressSupervisor)
    {
        _statusService = statusService;
        stressSupervisor.StatusChanged += OnStatusChanged;
    }

    public IAsyncEnumerable<InstanceStatusResponse> SubscribeAsync(CancellationToken cancellationToken)
    {
        var channel = Channel.CreateUnbounded<InstanceStatusResponse>(new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false
        });

        var id = Interlocked.Increment(ref _nextId);
        _subscribers[id] = channel;

        channel.Writer.TryWrite(_statusService.GetStatus());

        cancellationToken.Register(() => RemoveSubscriber(id));

        return channel.Reader.ReadAllAsync(cancellationToken);
    }

    public void Publish()
    {
        lock (_publishLock)
        {
            BroadcastSnapshot();
        }
    }

    private void BroadcastSnapshot()
    {
        if (_subscribers.IsEmpty)
        {
            return;
        }

        var snapshot = _statusService.GetStatus();
        foreach (var entry in _subscribers)
        {
            var writer = entry.Value.Writer;
            if (!writer.TryWrite(snapshot))
            {
                RemoveSubscriber(entry.Key);
            }
        }
    }

    private void OnStatusChanged()
    {
        Publish();
    }

    private void RemoveSubscriber(long id)
    {
        if (_subscribers.TryRemove(id, out var channel))
        {
            channel.Writer.TryComplete();
        }
    }
}
