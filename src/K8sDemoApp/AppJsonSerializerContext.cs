using System.Text.Json.Serialization;
using K8sDemoApp.Models;

namespace K8sDemoApp;

[JsonSerializable(typeof(InstanceStatusResponse))]
[JsonSerializable(typeof(ProbeSnapshot))]
[JsonSerializable(typeof(ProbeInfoDto))]
[JsonSerializable(typeof(StressSnapshot))]
[JsonSerializable(typeof(StressWorkloadStatus))]
[JsonSerializable(typeof(ScheduleDowntimeRequest))]
[JsonSerializable(typeof(StressCpuRequest))]
[JsonSerializable(typeof(StressMemoryRequest))]
[JsonSerializable(typeof(ApiError))]
[JsonSerializable(typeof(ApiMessage))]
[JsonSerializable(typeof(global::HealthPayload))]
internal partial class AppJsonSerializerContext : JsonSerializerContext;
