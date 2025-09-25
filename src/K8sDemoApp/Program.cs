using K8sDemoApp;
using K8sDemoApp.Application.Probes;
using K8sDemoApp.Application.Status;
using K8sDemoApp.Application.Stress;

var builder = WebApplication.CreateSlimBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonSerializerContext.Default);
});

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddProbeModule();
builder.Services.AddStressModule();
builder.Services.AddStatusModule();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapProbeModule();
app.MapStressModule();
app.MapStatusModule();

app.Run();
