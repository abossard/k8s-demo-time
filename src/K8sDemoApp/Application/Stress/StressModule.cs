using K8sDemoApp;
using K8sDemoApp.Application.Common;
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

    private static IResult HandleCpuStart(StressCpuRequest request, IStressSupervisor stress, IStatusStream statusStream)
    {
        if (!RequestValidators.TryGetDurationInMinutes(request.Minutes, MaxStressMinutes, out var duration, out var error))
        {
            return WriteError(error);
        }

        if (!RequestValidators.TryGetThreadCount(request.Threads, out var threads, out error))
        {
            return WriteError(error);
        }

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

    private static IResult HandleMemoryStart(StressMemoryRequest request, IStressSupervisor stress, IStatusStream statusStream)
    {
        if (!RequestValidators.TryGetDurationInMinutes(request.Minutes, MaxStressMinutes, out var duration, out var error))
        {
            return WriteError(error);
        }

        if (!RequestValidators.TryGetMemoryTarget(request.TargetMegabytes, MaxMemoryMegabytes, out var target, out error))
        {
            return WriteError(error);
        }

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
