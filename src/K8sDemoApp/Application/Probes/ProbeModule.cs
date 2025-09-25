using System.Globalization;
using K8sDemoApp;
using K8sDemoApp.Application.Common;
using K8sDemoApp.Application.Status;
using K8sDemoApp.Models;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

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
        endpoints.MapGet("/health/startup", (IProbeScheduler probes) => FormatHealth(probes, ProbeType.Startup));
        endpoints.MapGet("/health/readiness", (IProbeScheduler probes) => FormatHealth(probes, ProbeType.Readiness));
        endpoints.MapGet("/health/liveness", (IProbeScheduler probes) => FormatHealth(probes, ProbeType.Liveness));

        var group = endpoints.MapGroup("/api/probes");
        group.MapPost("/{probe}/down", HandleProbeDown);
        group.MapPost("/{probe}/up", HandleProbeUp);

        return endpoints;
    }

    private static IResult HandleProbeDown(string probe, ScheduleDowntimeRequest request, IProbeScheduler probes, IStatusStream statusStream)
    {
        if (!ProbeRoute.TryParse(probe, out var probeType))
        {
            return WriteError($"Unknown probe '{probe}'.");
        }

        if (!RequestValidators.TryGetDurationInMinutes(request.Minutes, MaxDowntimeMinutes, out var duration, out var error))
        {
            return WriteError(error);
        }

        var snapshot = probes.ScheduleDowntime(probeType, duration);
        statusStream.Publish();
        return Results.Json(snapshot, AppJsonSerializerContext.Default.ProbeInfoDto);
    }

    private static IResult HandleProbeUp(string probe, IProbeScheduler probes, IStatusStream statusStream)
    {
        if (!ProbeRoute.TryParse(probe, out var probeType))
        {
            return WriteError($"Unknown probe '{probe}'.");
        }

        var snapshot = probes.Restore(probeType);
        statusStream.Publish();
        return Results.Json(snapshot, AppJsonSerializerContext.Default.ProbeInfoDto);
    }

    private static IResult FormatHealth(IProbeScheduler probes, ProbeType type)
    {
        var healthy = probes.IsHealthy(type);
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
