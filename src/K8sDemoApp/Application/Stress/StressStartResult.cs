using K8sDemoApp.Models;

namespace K8sDemoApp.Application.Stress;

internal readonly record struct StressStartResult(bool Success, StressWorkloadStatus Status, string? Error)
{
    public static StressStartResult Successful(StressWorkloadStatus status) => new(true, status, null);
    public static StressStartResult Failure(string error, StressWorkloadStatus current) => new(false, current, error);
}
