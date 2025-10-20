using K8sDemoApp;
using K8sDemoApp.Application.Chaos;
using K8sDemoApp.Application.Coordination;
using K8sDemoApp.Application.Probes;
using K8sDemoApp.Application.Status;
using K8sDemoApp.Application.Stress;

var builder = WebApplication.CreateSlimBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonSerializerContext.Default);
});

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHttpClient("PodCoordination")
    .ConfigureHttpClient(client =>
    {
        client.Timeout = TimeSpan.FromSeconds(10);
    });
builder.Services.AddSingleton<IPodCoordinator, PodCoordinator>();
builder.Services.AddProbeModule();
builder.Services.AddStressModule();
builder.Services.AddStatusModule();
builder.Services.AddChaosModule();
builder.Services.AddHostedService<StatusHeartbeatService>();

var app = builder.Build();

app.UseAppFreezer();
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapProbeModule();
app.MapStressModule();
app.MapStatusModule();
app.MapChaosModule();

app.Run();
