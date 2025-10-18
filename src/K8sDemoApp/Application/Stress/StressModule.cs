using K8sDemoApp;
using K8sDemoApp.Application.Common;
using K8sDemoApp.Application.Coordination;
using K8sDemoApp.Application.Status;
using K8sDemoApp.Models;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace K8sDemoApp.Application.Stress;

internal static class StressModule
{
    private const double MaxStressMinutes = 60;
    private const int MaxMemoryMegabytes = 32_768;

    public static IServiceCollection AddStressModule(this IServiceCollection services)
    {
        services.AddSingleton<IStressSupervisor, StressCoordinator>();
        return services;
    }

    public static IEndpointRouteBuilder MapStressModule(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/stress");
        group.MapPost("/cpu", HandleCpuStart);
        group.MapDelete("/cpu", HandleCpuStop);
        group.MapPost("/memory", HandleMemoryStart);
        group.MapDelete("/memory", HandleMemoryStop);
        return endpoints;
    }

    private static async Task<IResult> HandleCpuStart(StressCpuRequest request, IStressSupervisor stress, IStatusStream statusStream, IPodCoordinator coordinator, ILoggerFactory loggerFactory)
    {
        if (!RequestValidators.TryGetDurationInMinutes(request.Minutes, MaxStressMinutes, out var duration, out var error))
        {
            return WriteError(error);
        }

        if (!RequestValidators.TryGetThreadCount(request.Threads, out var threads, out error))
        {
            return WriteError(error);
        }

        // If broadcast is requested, coordinate with other pods
        if (request.BroadcastToAll == true)
        {
            var logger = loggerFactory.CreateLogger("StressModule");
            logger.LogInformation("Broadcasting CPU stress to all pods. Duration: {Duration}, Threads: {Threads}", duration, threads);
            
            // Create a non-broadcast version of the request to send to other pods
            var localRequest = request with { BroadcastToAll = false };
            var broadcastResult = await coordinator.BroadcastToAllPodsAsync("/api/stress/cpu", localRequest);
            
            logger.LogInformation("CPU stress broadcast complete. Success: {Success}/{Total}, Failed: {Failed}", 
                broadcastResult.SuccessfulPods, broadcastResult.TotalPods, broadcastResult.FailedPods);
            
            if (broadcastResult.SuccessfulPods > 0)
            {
                return Results.Json(new 
                { 
                    message = $"CPU stress started on {broadcastResult.SuccessfulPods} of {broadcastResult.TotalPods} pods",
                    totalPods = broadcastResult.TotalPods,
                    successfulPods = broadcastResult.SuccessfulPods,
                    failedPods = broadcastResult.FailedPods,
                    errors = broadcastResult.Errors
                }, AppJsonSerializerContext.Default.Options);
            }
            
            return WriteError($"Failed to start CPU stress on any pods. Errors: {string.Join("; ", broadcastResult.Errors)}");
        }

        // Normal single-pod execution
        var result = stress.StartCpuStress(duration, threads);
        if (result.Success)
        {
            statusStream.Publish();
            return Results.Json(result.Status, AppJsonSerializerContext.Default.StressWorkloadStatus);
        }

        return WriteError(result.Error ?? "Unable to start CPU workload.");
    }

    private static IResult HandleCpuStop(IStressSupervisor stress, IStatusStream statusStream)
    {
        var snapshot = stress.CancelCpuStress();
        statusStream.Publish();
        return Results.Json(snapshot, AppJsonSerializerContext.Default.StressWorkloadStatus);
    }

    private static async Task<IResult> HandleMemoryStart(StressMemoryRequest request, IStressSupervisor stress, IStatusStream statusStream, IPodCoordinator coordinator, ILoggerFactory loggerFactory)
    {
        if (!RequestValidators.TryGetDurationInMinutes(request.Minutes, MaxStressMinutes, out var duration, out var error))
        {
            return WriteError(error);
        }

        if (!RequestValidators.TryGetMemoryTarget(request.TargetMegabytes, MaxMemoryMegabytes, out var target, out error))
        {
            return WriteError(error);
        }

        // If broadcast is requested, coordinate with other pods
        if (request.BroadcastToAll == true)
        {
            var logger = loggerFactory.CreateLogger("StressModule");
            logger.LogInformation("Broadcasting memory stress to all pods. Duration: {Duration}, Target: {Target}MB", duration, target);
            
            // Create a non-broadcast version of the request to send to other pods
            var localRequest = request with { BroadcastToAll = false };
            var broadcastResult = await coordinator.BroadcastToAllPodsAsync("/api/stress/memory", localRequest);
            
            logger.LogInformation("Memory stress broadcast complete. Success: {Success}/{Total}, Failed: {Failed}", 
                broadcastResult.SuccessfulPods, broadcastResult.TotalPods, broadcastResult.FailedPods);
            
            if (broadcastResult.SuccessfulPods > 0)
            {
                return Results.Json(new 
                { 
                    message = $"Memory stress started on {broadcastResult.SuccessfulPods} of {broadcastResult.TotalPods} pods",
                    totalPods = broadcastResult.TotalPods,
                    successfulPods = broadcastResult.SuccessfulPods,
                    failedPods = broadcastResult.FailedPods,
                    errors = broadcastResult.Errors
                }, AppJsonSerializerContext.Default.Options);
            }
            
            return WriteError($"Failed to start memory stress on any pods. Errors: {string.Join("; ", broadcastResult.Errors)}");
        }

        // Normal single-pod execution
        var result = stress.StartMemoryStress(duration, target);
        if (result.Success)
        {
            statusStream.Publish();
            return Results.Json(result.Status, AppJsonSerializerContext.Default.StressWorkloadStatus);
        }

        return WriteError(result.Error ?? "Unable to start memory workload.");
    }

    private static IResult HandleMemoryStop(IStressSupervisor stress, IStatusStream statusStream)
    {
        var snapshot = stress.CancelMemoryStress();
        statusStream.Publish();
        return Results.Json(snapshot, AppJsonSerializerContext.Default.StressWorkloadStatus);
    }

    private static IResult WriteError(string message)
    {
        return Results.Json(new ApiError(message), AppJsonSerializerContext.Default.ApiError, statusCode: StatusCodes.Status400BadRequest);
    }
}
