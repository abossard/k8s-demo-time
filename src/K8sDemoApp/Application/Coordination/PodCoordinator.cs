namespace K8sDemoApp.Application.Coordination;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using K8sDemoApp;
using Microsoft.Extensions.Logging;

internal interface IPodCoordinator
{
    Task<BroadcastResult> BroadcastToAllPodsAsync<TRequest>(string endpoint, TRequest request, CancellationToken cancellationToken = default);
}

internal sealed record BroadcastResult(int TotalPods, int SuccessfulPods, int FailedPods, List<string> Errors);

internal sealed class PodCoordinator : IPodCoordinator
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<PodCoordinator> _logger;
    private readonly string? _podNamespace;
    private readonly string? _serviceName;

    public PodCoordinator(IHttpClientFactory httpClientFactory, ILogger<PodCoordinator> logger, IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _podNamespace = Environment.GetEnvironmentVariable("POD_NAMESPACE");
        _serviceName = configuration.GetValue<string>("ServiceName") ?? "k8s-demo-app-headless";
    }

    public async Task<BroadcastResult> BroadcastToAllPodsAsync<TRequest>(string endpoint, TRequest request, CancellationToken cancellationToken = default)
    {
        var podIps = await DiscoverPodIpsAsync(cancellationToken);
        
        if (podIps.Count == 0)
        {
            _logger.LogWarning("No pods discovered for broadcast. Endpoint: {Endpoint}", endpoint);
            return new BroadcastResult(0, 0, 0, new List<string> { "No pods discovered for broadcast" });
        }

        _logger.LogInformation("Broadcasting to {Count} pods. Endpoint: {Endpoint}", podIps.Count, endpoint);

        var tasks = podIps.Select(ip => SendRequestToPodAsync(ip, endpoint, request, cancellationToken)).ToList();
        var results = await Task.WhenAll(tasks);

        var successful = results.Count(r => r.Success);
        var failed = results.Count(r => !r.Success);
        var errors = results.Where(r => !r.Success).Select(r => r.Error).Where(e => e != null).Cast<string>().ToList();

        _logger.LogInformation("Broadcast complete. Total: {Total}, Success: {Success}, Failed: {Failed}", 
            podIps.Count, successful, failed);

        return new BroadcastResult(podIps.Count, successful, failed, errors);
    }

    private async Task<List<string>> DiscoverPodIpsAsync(CancellationToken cancellationToken)
    {
        var podIps = new List<string>();

        try
        {
            // Try to discover pods via headless service DNS
            if (!string.IsNullOrEmpty(_serviceName) && !string.IsNullOrEmpty(_podNamespace))
            {
                var headlessServiceName = $"{_serviceName}.{_podNamespace}.svc.cluster.local";
                _logger.LogDebug("Resolving headless service: {ServiceName}", headlessServiceName);

                var addresses = await Dns.GetHostAddressesAsync(headlessServiceName, cancellationToken);
                podIps.AddRange(addresses.Select(a => a.ToString()));

                _logger.LogInformation("Discovered {Count} pod IPs via DNS", podIps.Count);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to discover pods via DNS. Falling back to single pod mode.");
        }

        // Fallback: if we couldn't discover any pods, just return localhost
        if (podIps.Count == 0)
        {
            _logger.LogDebug("No pods discovered via DNS, using localhost as fallback");
            podIps.Add("127.0.0.1");
        }

        return podIps;
    }

    private async Task<(bool Success, string? Error)> SendRequestToPodAsync<TRequest>(
        string podIp, 
        string endpoint, 
        TRequest request, 
        CancellationToken cancellationToken)
    {
        try
        {
            var client = _httpClientFactory.CreateClient("PodCoordination");
            var url = $"http://{podIp}:8080{endpoint}";
            
            _logger.LogDebug("Sending request to pod at {Url}", url);

            var response = await client.PostAsJsonAsync(url, request, AppJsonSerializerContext.Default.Options, cancellationToken);
            
            if (response.IsSuccessStatusCode)
            {
                _logger.LogDebug("Successfully sent request to pod at {Url}", url);
                return (true, null);
            }
            
            var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
            var error = $"Pod {podIp}: HTTP {(int)response.StatusCode} - {errorContent}";
            _logger.LogWarning("Failed to send request to pod at {Url}. Status: {Status}", url, response.StatusCode);
            return (false, error);
        }
        catch (TaskCanceledException)
        {
            _logger.LogWarning("Request to pod {PodIp} timed out", podIp);
            return (false, $"Pod {podIp}: Request timed out");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending request to pod {PodIp}", podIp);
            return (false, $"Pod {podIp}: {ex.Message}");
        }
    }
}
