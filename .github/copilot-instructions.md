# GitHub Copilot Instructions for K8s Demo Time

## Project Overview

K8s Demo Time is a .NET 9.0 Web API designed to showcase Kubernetes probe behaviour, resource management, and autoscaling features. The application provides a hands-on demo environment for learning about HPA, VPA, probes, and resource pressure in Kubernetes clusters. The codebase is designed with AOT compatibility in mind (using source generators for JSON serialization), though native AOT publishing is currently disabled.

## Technology Stack

- **Language**: .NET 9.0 (C#)
- **Runtime**: Standard .NET runtime (AOT disabled in current configuration, but designed for AOT compatibility)
- **Web Framework**: ASP.NET Core Minimal APIs
- **Infrastructure**: Azure Kubernetes Service (AKS), Azure Container Registry (ACR)
- **IaC**: Bicep templates for Azure deployment
- **Container**: Docker with multi-stage builds
- **Orchestration**: Kubernetes manifests (deployments, services, HPA, VPA)

## Project Structure

```
/src/K8sDemoApp/          # Main .NET application
  - Application/          # API modules (Status, Probe, Stress, Chaos)
  - Models/              # Data models
  - wwwroot/             # Static web dashboard
  - Program.cs           # Application entry point
/k8s/                    # Kubernetes manifests
  - deployment.yaml      # Main deployment manifest
  - hpa/                 # HPA tutorial manifests
  - vpa/                 # VPA examples
  - qos/                 # QoS class examples
  - combined/            # Combined scenarios
/infra/                  # Azure Bicep templates
  - main.bicep           # Main infrastructure template
  - modules/             # Reusable Bicep modules
```

## Building and Testing

### Prerequisites
- .NET 9.0 SDK
- Docker (for container builds)
- kubectl (for Kubernetes deployment)
- Azure CLI (for Azure deployment)

### Local Development

```bash
cd src/K8sDemoApp
dotnet restore
dotnet build
dotnet run --urls http://localhost:8080
```

### Build Docker Image

```bash
# Ensure AMD64 platform for AKS compatibility
export DOCKER_DEFAULT_PLATFORM=linux/amd64
docker build --platform linux/amd64 -t k8s-demo-app:local .
```

### Testing
- The application uses manual integration testing via the web dashboard at `/`
- API endpoints can be tested using the provided `K8sDemoApp.http` file
- No automated unit test suite is currently present

## Code Style and Conventions

### General Guidelines
- **Minimal APIs**: Use ASP.NET Core minimal API patterns for endpoint definitions
- **Immutability**: Prefer immutable records for data models
- **Null Safety**: Leverage C# nullable reference types (`#nullable enable`)
- **AOT Compatibility**: Code is designed to be AOT-compatible (though `PublishAot` is currently set to `false`)
  - Avoid dynamic code generation
  - Use source generators for JSON serialization (see `AppJsonSerializerContext.cs`)
  - Minimize reflection-based features
  - Keep these practices even though AOT is not currently enabled
- **Async/Await**: Use async patterns for I/O-bound operations
- **Error Handling**: Return appropriate HTTP status codes and problem details

### Architecture Patterns
- **Module Organization**: Group related endpoints into static module classes (e.g., `StatusModule`, `ProbeModule`, `StressModule`)
- **Separation of Concerns**: Keep business logic separate from endpoint definitions
- **Dependency Injection**: Use built-in DI for services and configuration
- **State Management**: Use thread-safe singleton services for shared state
- **Broadcasting**: Support optional `broadcastToAll` parameter for replica coordination via DNS-based service discovery

## Key Features to Maintain

1. **Probe Management**: Configurable startup, readiness, and liveness probes
2. **Stress Testing**: CPU and memory stress endpoints with time-based control
3. **Chaos Engineering**: Process crash and request freeze capabilities
4. **Broadcast Coordination**: Cross-replica action coordination using headless service DNS
5. **Live Dashboard**: Real-time SSE-based status updates with per-pod color theming
6. **Resource Monitoring**: Display of resource requests, limits, and current usage

## Infrastructure as Code

### Bicep Templates
- **Location**: `/infra/main.bicep`
- **Scope**: Subscription-level deployment
- **Resources**: ACR, AKS cluster with optional features
- **Naming**: Use consistent naming conventions with PREFIX variable
- **Security**: Enable RBAC, use managed identities, anonymous pull for ACR

### Kubernetes Manifests
- **Resource Requests/Limits**: Always define for autoscaling demos
- **Probes**: Include all three probe types (startup, readiness, liveness)
- **Services**: Use ClusterIP for internal access, optionally expose with LoadBalancer
- **Labels**: Maintain consistent labeling for service discovery
- **Annotations**: Document purpose and demo scenarios

## Making Changes

### When Adding Features
1. Consider AOT compatibility implications
2. Update the dashboard UI if adding new endpoints
3. Add broadcast support for actions that may need cross-replica coordination
4. Update relevant documentation (README, guides)
5. Test locally before creating container images

### When Modifying Infrastructure
1. Validate Bicep templates with `az bicep build`
2. Test in a dev environment before production
3. Update parameter examples in README
4. Consider backward compatibility

### When Changing Kubernetes Manifests
1. Validate YAML syntax
2. Test resource requests/limits for HPA demos
3. Ensure probe configurations remain functional
4. Update related tutorial documentation

## Security Considerations

- **No Secrets in Code**: Never commit credentials or sensitive data
- **ACR Access**: Use managed identity for AKS to ACR authentication
- **RBAC**: Follow least-privilege principle for cluster admin access
- **Network Policies**: Consider Cilium network policy examples
- **Resource Limits**: Always define limits to prevent resource exhaustion

## Documentation

- Keep README.md up to date with major changes
- Tutorial documents (HPA-Interactive-Tutorial.md, AUTOSCALING-GUIDE.md, etc.) should reflect current functionality
- Update VISUAL-GUIDE.md if adding new UI features
- TODO.md tracks pending improvements

## Common Tasks

### Adding a New API Endpoint
1. Create or update module in `Application/` directory
2. Register endpoint in `Program.cs`
3. Add to `AppJsonSerializerContext` if new models are introduced
4. Update dashboard in `wwwroot/` if UI integration needed
5. Test with `K8sDemoApp.http`

### Modifying Probe Behavior
1. Update `ProbeModule.cs` and `ProbeStateStore.cs`
2. Ensure health endpoints remain Kubernetes-compatible
3. Test with `kubectl describe pod` to verify probe responses
4. Update documentation on probe configuration

### Infrastructure Updates
1. Modify Bicep templates in `/infra/`
2. Test deployment with `az deployment sub create`
3. Verify resource creation and configuration
4. Update deployment documentation

## Workflow Tips

- **Incremental Changes**: Make small, focused changes
- **Test Locally First**: Run the app locally before building containers
- **Docker Builds**: Remember to specify `linux/amd64` platform
- **Dashboard Testing**: Always check the web UI at `http://localhost:8080`
- **Kubernetes Testing**: Use `kubectl port-forward` for local access
- **Logs**: Check pod logs with `kubectl logs` for debugging

## References

- Main documentation: README.md
- HPA tutorial: HPA-Interactive-Tutorial.md
- Autoscaling guide: AUTOSCALING-GUIDE.md
- Broadcast coordination: BROADCAST-COORDINATION.md
- Visual guide: VISUAL-GUIDE.md
- Planned work: TODO.md
