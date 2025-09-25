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
        return services;
    }

    public static IEndpointRouteBuilder MapStatusModule(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/status", (StatusService status) =>
        {
            var snapshot = status.GetStatus();
            return TypedResults.Json(snapshot, AppJsonSerializerContext.Default.InstanceStatusResponse);
        });

        return endpoints;
    }
}
