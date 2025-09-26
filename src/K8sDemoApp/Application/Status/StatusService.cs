using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Net.Sockets;
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
    private readonly InstanceEnvironmentInfo _environment;
    private readonly ResourceCapacity _resourceRequests;
    private readonly ResourceCapacity _resourceLimits;
    private readonly Queue<CpuSample> _cpuSamples = new();
    private readonly object _resourceLock = new();
    private readonly Process _process;
    private readonly int _processorCount;
    private static readonly TimeSpan UsageWindow = TimeSpan.FromSeconds(10);
    private long _sequence;

    public StatusService(TimeProvider timeProvider, IProbeScheduler probes, IStressSupervisor stress)
    {
        _timeProvider = timeProvider;
        _probes = probes;
        _stress = stress;
        _startedAtUtc = timeProvider.GetUtcNow();
        _hostname = Environment.MachineName;
        _environment = BuildEnvironment();
        _resourceRequests = BuildCapacity("RESOURCE_REQUEST_CPU", "RESOURCE_REQUEST_MEMORY");
        _resourceLimits = BuildCapacity("RESOURCE_LIMIT_CPU", "RESOURCE_LIMIT_MEMORY");
        _processorCount = Math.Max(Environment.ProcessorCount, 1);
        _process = Process.GetCurrentProcess();

        lock (_resourceLock)
        {
            _cpuSamples.Enqueue(new CpuSample(_startedAtUtc, _process.TotalProcessorTime));
        }
    }

    public InstanceStatusResponse GetStatus()
    {
        var now = _timeProvider.GetUtcNow();
        var sequence = Interlocked.Increment(ref _sequence);
        var resources = GetResources(now);
        return new InstanceStatusResponse(
            sequence,
            _hostname,
            _startedAtUtc,
            now,
            now - _startedAtUtc,
            _environment,
            resources,
            _probes.GetSnapshot(),
            _stress.GetSnapshot());
    }

    private InstanceEnvironmentInfo BuildEnvironment()
    {
        var addresses = GetHostIpAddresses();
        var podIp = GetEnv("POD_IP") ?? addresses.FirstOrDefault();
        return new InstanceEnvironmentInfo(
            addresses,
            GetEnv("POD_NAME"),
            GetEnv("POD_NAMESPACE"),
            GetEnv("POD_UID"),
            podIp,
            CoalesceEnv("POD_SERVICE_ACCOUNT", "SERVICE_ACCOUNT", "SERVICE_ACCOUNT_NAME", "SERVICEACCOUNT_NAME"),
            GetEnv("NODE_NAME"),
            GetEnv("NODE_IP"),
            GetEnv("CLUSTER_NAME"),
            GetEnv("CLUSTER_DOMAIN"));
    }

    private string[] GetHostIpAddresses()
    {
        try
        {
            var entries = Dns.GetHostEntry(_hostname).AddressList
                .Where(static address => !IPAddress.IsLoopback(address))
                .OrderBy(static address => address.AddressFamily == AddressFamily.InterNetwork ? 0 : 1)
                .ThenBy(static address => address.ToString(), StringComparer.Ordinal)
                .Select(static address => address.ToString())
                .Distinct(StringComparer.Ordinal)
                .ToArray();

            return entries.Length == 0 ? Array.Empty<string>() : entries;
        }
        catch (SocketException)
        {
        }
        catch (Exception)
        {
        }

        return Array.Empty<string>();
    }

    private InstanceResourcesInfo GetResources(DateTimeOffset timestamp)
    {
        var usage = CaptureResourceUsage(timestamp);
        var requests = new ResourceCapacity(_resourceRequests.Cpu, _resourceRequests.Memory);
        var limits = new ResourceCapacity(_resourceLimits.Cpu, _resourceLimits.Memory);
        return new InstanceResourcesInfo(requests, limits, usage);
    }

    private InstanceResourceUsage CaptureResourceUsage(DateTimeOffset timestamp)
    {
        lock (_resourceLock)
        {
            _process.Refresh();
            var workingSet = _process.WorkingSet64;
            var managedMemory = GC.GetTotalMemory(false);
            var cpuTime = _process.TotalProcessorTime;

            _cpuSamples.Enqueue(new CpuSample(timestamp, cpuTime));

            while (_cpuSamples.Count > 1 && timestamp - _cpuSamples.Peek().Timestamp > UsageWindow)
            {
                _cpuSamples.Dequeue();
            }

            double cpuMillicores = 0;
            double cpuPercent = 0;
            if (_cpuSamples.Count > 1)
            {
                var oldest = _cpuSamples.Peek();
                var elapsed = timestamp - oldest.Timestamp;
                if (elapsed > TimeSpan.Zero)
                {
                    var cpuElapsedMs = (cpuTime - oldest.ProcessorTime).TotalMilliseconds;
                    var elapsedMs = elapsed.TotalMilliseconds;
                    if (elapsedMs > 0)
                    {
                        var averageCores = Math.Max(cpuElapsedMs / elapsedMs, 0d);
                        cpuMillicores = averageCores * 1000d;
                        if (_processorCount > 0)
                        {
                            cpuPercent = averageCores / _processorCount * 100d;
                        }
                    }
                }
            }

            var roundedMillicores = Math.Round(cpuMillicores, 0, MidpointRounding.AwayFromZero);
            var roundedPercent = Math.Round(cpuPercent, 1, MidpointRounding.AwayFromZero);
            return new InstanceResourceUsage(roundedMillicores, roundedPercent, workingSet, managedMemory);
        }
    }

    private static string? GetEnv(string key)
    {
        var value = Environment.GetEnvironmentVariable(key);
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    private static ResourceCapacity BuildCapacity(string cpuKey, string memoryKey)
    {
        return new ResourceCapacity(GetEnv(cpuKey), GetEnv(memoryKey));
    }

    private static string? CoalesceEnv(params string[] keys)
    {
        foreach (var key in keys)
        {
            var value = GetEnv(key);
            if (!string.IsNullOrEmpty(value))
            {
                return value;
            }
        }

        return null;
    }

    private readonly struct CpuSample
    {
        public CpuSample(DateTimeOffset timestamp, TimeSpan processorTime)
        {
            Timestamp = timestamp;
            ProcessorTime = processorTime;
        }

        public DateTimeOffset Timestamp { get; }

        public TimeSpan ProcessorTime { get; }
    }
}
