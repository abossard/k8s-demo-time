using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using K8sDemoApp;

namespace K8sDemoApp.Application.Status;

internal static class StatusModule
{
    public static IServiceCollection AddStatusModule(this IServiceCollection services)
    {
        services.AddSingleton<StatusService>();
        services.AddSingleton<IStatusStream, StatusStream>();
        return services;
    }

    public static IEndpointRouteBuilder MapStatusModule(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/status", (StatusService status) =>
        {
            var snapshot = status.GetStatus();
            return TypedResults.Json(snapshot, AppJsonSerializerContext.Default.InstanceStatusResponse);
        });

        endpoints.MapGet("/api/status/stream", StreamStatusAsync);

        return endpoints;
    }

    private static async Task StreamStatusAsync(HttpContext context, IStatusStream stream, CancellationToken cancellationToken)
    {
        context.Response.Headers["Cache-Control"] = "no-cache";
        context.Response.Headers["Connection"] = "keep-alive";
        context.Response.Headers["X-Accel-Buffering"] = "no";
        context.Response.ContentType = "text/event-stream";

        await foreach (var snapshot in stream.SubscribeAsync(cancellationToken))
        {
            var payload = JsonSerializer.Serialize(snapshot, AppJsonSerializerContext.Default.InstanceStatusResponse);
            await context.Response.WriteAsync($"data: {payload}\n\n", cancellationToken).ConfigureAwait(false);
            await context.Response.Body.FlushAsync(cancellationToken).ConfigureAwait(false);
        }
    }
}
