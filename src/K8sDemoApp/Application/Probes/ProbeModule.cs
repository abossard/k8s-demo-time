using System.Globalization;
using K8sDemoApp;
using K8sDemoApp.Application.Common;
using K8sDemoApp.Application.Coordination;
using K8sDemoApp.Application.Status;
using K8sDemoApp.Models;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace K8sDemoApp.Application.Probes;

internal static class ProbeModule
{
    private const double MaxDowntimeMinutes = 24 * 60;

    public static IServiceCollection AddProbeModule(this IServiceCollection services)
    {
        services.AddSingleton<IProbeScheduler>(sp =>
        {
            var timeProvider = sp.GetRequiredService<TimeProvider>();
            var configuration = sp.GetRequiredService<IConfiguration>();
            var holdDuration = ParseStartupHold(configuration);
            return new ProbeStateStore(timeProvider, holdDuration);
        });
        return services;
    }

    public static IEndpointRouteBuilder MapProbeModule(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/health/startup", (IProbeScheduler probes, IStatusStream statusStream) => FormatHealth(probes, statusStream, ProbeType.Startup));
        endpoints.MapGet("/health/readiness", (IProbeScheduler probes, IStatusStream statusStream) => FormatHealth(probes, statusStream, ProbeType.Readiness));
        endpoints.MapGet("/health/liveness", (IProbeScheduler probes, IStatusStream statusStream) => FormatHealth(probes, statusStream, ProbeType.Liveness));

        var group = endpoints.MapGroup("/api/probes");
        group.MapPost("/{probe}/down", HandleProbeDown);
        group.MapPost("/{probe}/up", HandleProbeUp);

        return endpoints;
    }

    private static async Task<IResult> HandleProbeDown(string probe, ScheduleDowntimeRequest request, IProbeScheduler probes, IStatusStream statusStream, IPodCoordinator coordinator, ILoggerFactory loggerFactory)
    {
        if (!ProbeRoute.TryParse(probe, out var probeType))
        {
            return WriteError($"Unknown probe '{probe}'.");
        }

        if (!RequestValidators.TryGetDurationInMinutes(request.Minutes, MaxDowntimeMinutes, out var duration, out var error))
        {
            return WriteError(error);
        }

        // If broadcast is requested, coordinate with other pods
        if (request.BroadcastToAll == true)
        {
            var logger = loggerFactory.CreateLogger("ProbeModule");
            logger.LogInformation("Broadcasting probe downtime to all pods. Probe: {Probe}, Duration: {Duration}", probe, duration);
            
            // Create a non-broadcast version of the request to send to other pods
            var localRequest = request with { BroadcastToAll = false };
            var broadcastResult = await coordinator.BroadcastToAllPodsAsync($"/api/probes/{probe}/down", localRequest);
            
            logger.LogInformation("Probe downtime broadcast complete. Success: {Success}/{Total}, Failed: {Failed}", 
                broadcastResult.SuccessfulPods, broadcastResult.TotalPods, broadcastResult.FailedPods);
            
            if (broadcastResult.SuccessfulPods > 0)
            {
                var response = new BroadcastResponse(
                    $"Probe {probe} taken down on {broadcastResult.SuccessfulPods} of {broadcastResult.TotalPods} pods",
                    broadcastResult.TotalPods,
                    broadcastResult.SuccessfulPods,
                    broadcastResult.FailedPods,
                    broadcastResult.Errors
                );
                return Results.Json(response, AppJsonSerializerContext.Default.BroadcastResponse);
            }
            
            return WriteError($"Failed to take probe down on any pods. Errors: {string.Join("; ", broadcastResult.Errors)}");
        }

        // Normal single-pod execution
        var snapshot = probes.ScheduleDowntime(probeType, duration);
        statusStream.Publish();
        return Results.Json(snapshot, AppJsonSerializerContext.Default.ProbeInfoDto);
    }

    private static async Task<IResult> HandleProbeUp(string probe, IProbeScheduler probes, IStatusStream statusStream, IPodCoordinator coordinator, ILoggerFactory loggerFactory, HttpContext context)
    {
        if (!ProbeRoute.TryParse(probe, out var probeType))
        {
            return WriteError($"Unknown probe '{probe}'.");
        }

        // Check if broadcastToAll is in query string or body
        var broadcastToAll = context.Request.Query.ContainsKey("broadcastToAll") 
            ? bool.TryParse(context.Request.Query["broadcastToAll"], out var val) && val
            : false;

        // If broadcast is requested, coordinate with other pods
        if (broadcastToAll)
        {
            var logger = loggerFactory.CreateLogger("ProbeModule");
            logger.LogInformation("Broadcasting probe restore to all pods. Probe: {Probe}", probe);
            
            // Note: Using empty object since /up endpoint doesn't require a request body
            var broadcastResult = await coordinator.BroadcastToAllPodsAsync($"/api/probes/{probe}/up", new { });
            
            logger.LogInformation("Probe restore broadcast complete. Success: {Success}/{Total}, Failed: {Failed}", 
                broadcastResult.SuccessfulPods, broadcastResult.TotalPods, broadcastResult.FailedPods);
            
            if (broadcastResult.SuccessfulPods > 0)
            {
                var response = new BroadcastResponse(
                    $"Probe {probe} restored on {broadcastResult.SuccessfulPods} of {broadcastResult.TotalPods} pods",
                    broadcastResult.TotalPods,
                    broadcastResult.SuccessfulPods,
                    broadcastResult.FailedPods,
                    broadcastResult.Errors
                );
                return Results.Json(response, AppJsonSerializerContext.Default.BroadcastResponse);
            }
            
            return WriteError($"Failed to restore probe on any pods. Errors: {string.Join("; ", broadcastResult.Errors)}");
        }

        // Normal single-pod execution
        var snapshot = probes.Restore(probeType);
        statusStream.Publish();
        return Results.Json(snapshot, AppJsonSerializerContext.Default.ProbeInfoDto);
    }

    private static IResult FormatHealth(IProbeScheduler probes, IStatusStream statusStream, ProbeType type)
    {
        var healthy = probes.IsHealthy(type);
        statusStream.Publish();
        var payload = new HealthPayload(healthy ? "ok" : "down");
        return healthy
            ? Results.Json(payload, AppJsonSerializerContext.Default.HealthPayload)
            : Results.Json(payload, AppJsonSerializerContext.Default.HealthPayload, statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    private static IResult WriteError(string message)
    {
        return Results.Json(new ApiError(message), AppJsonSerializerContext.Default.ApiError, statusCode: StatusCodes.Status400BadRequest);
    }

    private static TimeSpan ParseStartupHold(IConfiguration configuration)
    {
        var value = configuration["HOLD_STARTUP_SECONDS"];
        if (string.IsNullOrWhiteSpace(value))
        {
            return TimeSpan.Zero;
        }

        if (TryParseSeconds(value, out var seconds) && seconds > 0)
        {
            return TimeSpan.FromSeconds(seconds);
        }

        return TimeSpan.Zero;
    }

    private static bool TryParseSeconds(string value, out double seconds)
    {
        if (double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out seconds))
        {
            return true;
        }

        return double.TryParse(value, NumberStyles.Float, CultureInfo.CurrentCulture, out seconds);
    }
}
