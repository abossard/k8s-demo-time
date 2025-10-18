using System.Text.Json.Serialization;
using K8sDemoApp.Application.Common;
using K8sDemoApp.Models;

namespace K8sDemoApp;

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(InstanceStatusResponse))]
[JsonSerializable(typeof(InstanceEnvironmentInfo))]
[JsonSerializable(typeof(InstanceResourcesInfo))]
[JsonSerializable(typeof(ResourceCapacity))]
[JsonSerializable(typeof(InstanceResourceUsage))]
[JsonSerializable(typeof(ProbeSnapshot))]
[JsonSerializable(typeof(ProbeInfoDto))]
[JsonSerializable(typeof(StressSnapshot))]
[JsonSerializable(typeof(StressWorkloadStatus))]
[JsonSerializable(typeof(ScheduleDowntimeRequest))]
[JsonSerializable(typeof(StressCpuRequest))]
[JsonSerializable(typeof(StressMemoryRequest))]
[JsonSerializable(typeof(FreezeRequest))]
[JsonSerializable(typeof(ApiError))]
[JsonSerializable(typeof(ApiMessage))]
[JsonSerializable(typeof(BroadcastResponse))]
[JsonSerializable(typeof(HealthPayload))]
internal partial class AppJsonSerializerContext : JsonSerializerContext;
