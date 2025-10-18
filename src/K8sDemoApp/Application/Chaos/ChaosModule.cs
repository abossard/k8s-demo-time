using System;
using System.Threading;
using System.Threading.Tasks;
using K8sDemoApp;
using K8sDemoApp.Application.Common;
using K8sDemoApp.Application.Coordination;
using K8sDemoApp.Models;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace K8sDemoApp.Application.Chaos;

internal static class ChaosModule
{
    private const double MaxFreezeMinutes = 30;

    public static IServiceCollection AddChaosModule(this IServiceCollection services)
    {
        services.AddSingleton<IAppFreezer, AppFreezer>();
        return services;
    }

    public static IApplicationBuilder UseAppFreezer(this IApplicationBuilder app)
    {
        return app.Use(async (context, next) =>
        {
            var freezer = context.RequestServices.GetRequiredService<IAppFreezer>();
            await freezer.WaitIfFrozenAsync(context.RequestAborted).ConfigureAwait(false);
            await next(context).ConfigureAwait(false);
        });
    }

    public static IEndpointRouteBuilder MapChaosModule(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/chaos");
        group.MapPost("/crash", TriggerCrash);
        group.MapPost("/freeze", TriggerFreeze);
        return endpoints;
    }

    private static IResult TriggerCrash()
    {
        _ = Task.Run(async () =>
        {
            await Task.Delay(TimeSpan.FromMilliseconds(200)).ConfigureAwait(false);
            Environment.FailFast("Crash requested via chaos endpoint.");
        });

        return Results.Json(new ApiMessage("Crash scheduled. Container will terminate momentarily."), AppJsonSerializerContext.Default.ApiMessage);
    }

    private static async Task<IResult> TriggerFreeze(FreezeRequest request, IAppFreezer freezer, IPodCoordinator coordinator, ILoggerFactory loggerFactory)
    {
        if (!RequestValidators.TryGetDurationInMinutes(request.Minutes, MaxFreezeMinutes, out var duration, out var error))
        {
            return Results.Json(new ApiError(error), AppJsonSerializerContext.Default.ApiError, statusCode: StatusCodes.Status400BadRequest);
        }

        // If broadcast is requested, coordinate with other pods
        if (request.BroadcastToAll == true)
        {
            var logger = loggerFactory.CreateLogger("ChaosModule");
            logger.LogInformation("Broadcasting freeze to all pods. Duration: {Duration}", duration);
            
            // Create a non-broadcast version of the request to send to other pods
            var localRequest = request with { BroadcastToAll = false };
            var broadcastResult = await coordinator.BroadcastToAllPodsAsync("/api/chaos/freeze", localRequest);
            
            logger.LogInformation("Freeze broadcast complete. Success: {Success}/{Total}, Failed: {Failed}", 
                broadcastResult.SuccessfulPods, broadcastResult.TotalPods, broadcastResult.FailedPods);
            
            if (broadcastResult.SuccessfulPods > 0)
            {
                var response = new BroadcastResponse(
                    $"Application frozen on {broadcastResult.SuccessfulPods} of {broadcastResult.TotalPods} pods",
                    broadcastResult.TotalPods,
                    broadcastResult.SuccessfulPods,
                    broadcastResult.FailedPods,
                    broadcastResult.Errors
                );
                return Results.Json(response, AppJsonSerializerContext.Default.BroadcastResponse);
            }
            
            return Results.Json(new ApiError($"Failed to freeze any pods. Errors: {string.Join("; ", broadcastResult.Errors)}"), 
                AppJsonSerializerContext.Default.ApiError, statusCode: StatusCodes.Status400BadRequest);
        }

        // Normal single-pod execution
        freezer.Freeze(duration);

        var message = duration.TotalMinutes >= 1
            ? $"Application frozen for {duration.TotalMinutes:F1} minute(s)."
            : $"Application frozen for {duration.TotalSeconds:F0} second(s).";

        return Results.Json(new ApiMessage(message), AppJsonSerializerContext.Default.ApiMessage);
    }
}
