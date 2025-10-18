namespace K8sDemoApp.Models;

public sealed record ApiError(string Message);

public sealed record ApiMessage(string Message);

public sealed record BroadcastResponse(string Message, int TotalPods, int SuccessfulPods, int FailedPods, List<string> Errors);
