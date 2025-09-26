using System;
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
    private long _sequence;

    public StatusService(TimeProvider timeProvider, IProbeScheduler probes, IStressSupervisor stress)
    {
        _timeProvider = timeProvider;
        _probes = probes;
        _stress = stress;
        _startedAtUtc = timeProvider.GetUtcNow();
        _hostname = Environment.MachineName;
        _environment = BuildEnvironment();
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
            _environment,
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

    private static string? GetEnv(string key)
    {
        var value = Environment.GetEnvironmentVariable(key);
        return string.IsNullOrWhiteSpace(value) ? null : value;
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
}
