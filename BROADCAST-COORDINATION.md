# Pod Coordination and Broadcast Feature

This document describes the pod coordination feature that allows actions to be broadcast to all replicas in the deployment.

## Overview

Previously, the k8s-demo-app was entirely pod-based - when you triggered CPU stress, memory stress, or probe failures via the REST API or UI, only the pod that received the request would execute the action.

With the new broadcast coordination feature, you can now choose to apply actions to **all replicas** simultaneously by setting the `broadcastToAll` parameter to `true`.

## How It Works

### Architecture

The coordination mechanism uses Kubernetes DNS-based service discovery:

1. A **headless service** (`k8s-demo-app-headless`) is deployed alongside the regular service
2. When broadcast is requested, the `PodCoordinator` service resolves the headless service DNS name to discover all pod IPs
3. The coordinator makes parallel HTTP requests to all discovered pods
4. Results are aggregated and returned to the caller

### DNS Service Discovery

The headless service (`k8s-demo-app-headless`) with `clusterIP: None` allows DNS queries to return all pod IPs instead of a single cluster IP. The coordinator queries:
```
k8s-demo-app-headless.{namespace}.svc.cluster.local
```

This returns A records for all healthy pods in the deployment.

## API Usage

All stress, probe, and chaos endpoints now support an optional `broadcastToAll` parameter.

### CPU Stress

```bash
# Single pod (existing behavior)
curl -X POST http://localhost:8080/api/stress/cpu \
  -H "Content-Type: application/json" \
  -d '{"minutes": 2, "threads": 4, "broadcastToAll": false}'

# All replicas (new behavior)
curl -X POST http://localhost:8080/api/stress/cpu \
  -H "Content-Type: application/json" \
  -d '{"minutes": 2, "threads": 4, "broadcastToAll": true}'
```

**Broadcast Response:**
```json
{
  "message": "CPU stress started on 3 of 3 pods",
  "totalPods": 3,
  "successfulPods": 3,
  "failedPods": 0,
  "errors": []
}
```

### Memory Stress

```bash
# All replicas
curl -X POST http://localhost:8080/api/stress/memory \
  -H "Content-Type: application/json" \
  -d '{"minutes": 1, "targetMegabytes": 512, "broadcastToAll": true}'
```

### Probe Control

```bash
# Take down readiness probe on all replicas
curl -X POST http://localhost:8080/api/probes/readiness/down \
  -H "Content-Type: application/json" \
  -d '{"minutes": 5, "broadcastToAll": true}'

# Restore liveness probe on all replicas
curl -X POST http://localhost:8080/api/probes/liveness/up \
  -H "Content-Type: application/json" \
  -d '{"broadcastToAll": true}'
```

### Chaos Operations

```bash
# Freeze all replicas
curl -X POST http://localhost:8080/api/chaos/freeze \
  -H "Content-Type: application/json" \
  -d '{"minutes": 5, "broadcastToAll": true}'
```

## UI Usage

The web dashboard now includes an **"All replicas"** checkbox for each action:

- **Probes Section**: Checkbox next to each probe's downtime controls
- **CPU Stress**: Checkbox next to the start button
- **Memory Stress**: Checkbox next to the start button  
- **Chaos/Freeze**: Checkbox next to the freeze button

When checked, the action will be broadcast to all pods in the deployment.

![UI with broadcast checkboxes](https://github.com/user-attachments/assets/3dbe6d0c-00ce-48c6-9bc7-07a38f9544dc)

## Configuration

The coordinator can be configured via `appsettings.json`:

```json
{
  "ServiceName": "k8s-demo-app-headless"
}
```

This value can also be set via environment variable:
```yaml
env:
  - name: ServiceName
    value: "k8s-demo-app-headless"
```

## Deployment Requirements

To use the broadcast feature, ensure the headless service is deployed:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: k8s-demo-app-headless
  labels:
    app: k8s-demo-app
spec:
  clusterIP: None
  selector:
    app: k8s-demo-app
  ports:
    - name: http
      port: 8080
      targetPort: http
```

This is already included in the default `k8s/deployment.yaml`.

## Use Cases

### Testing HPA Behavior
Broadcast CPU stress to all replicas to observe how the Horizontal Pod Autoscaler scales the deployment up and then back down.

### Simulating Network Partitions
Take down readiness probes on all replicas to simulate pods becoming unhealthy and observe how the service handles traffic.

### Load Testing
Apply memory or CPU stress across all pods simultaneously to test cluster resource limits and QoS behavior.

### Chaos Engineering
Freeze multiple pods at once to test application resilience and failover mechanisms.

## Limitations

- The broadcast feature requires all pods to be reachable via HTTP on port 8080
- DNS resolution requires pods to be in the same namespace
- Failed broadcasts to individual pods are logged but don't block the overall operation
- The crash endpoint (`/api/chaos/crash`) intentionally does not support broadcast to prevent accidentally crashing all pods

## Troubleshooting

### No pods discovered
- Verify the headless service exists: `kubectl get svc k8s-demo-app-headless`
- Check DNS resolution from within a pod: `nslookup k8s-demo-app-headless`
- Ensure `POD_NAMESPACE` environment variable is set correctly

### Partial broadcast failures
- Check logs for individual pod errors: `kubectl logs <pod-name>`
- Verify network policies allow pod-to-pod communication on port 8080
- Ensure all pods are healthy and accepting requests

### Timeouts
- The default HTTP client timeout is 10 seconds per pod
- Adjust in `Program.cs` if needed:
  ```csharp
  builder.Services.AddHttpClient("PodCoordination")
      .ConfigureHttpClient(client =>
      {
          client.Timeout = TimeSpan.FromSeconds(30);
      });
  ```

## Implementation Details

Key components:

- **`PodCoordinator`** (`Application/Coordination/PodCoordinator.cs`): Handles service discovery and HTTP communication
- **`BroadcastResponse`** (`Models/ApiContracts.cs`): Response model for broadcast operations
- **Request Models** (`Models/Requests.cs`): All request models now include optional `BroadcastToAll` property
- **Module Updates**: StressModule, ProbeModule, and ChaosModule check for broadcast flag and coordinate when needed

The coordinator operates as follows:
1. Resolve headless service DNS to get all pod IPs
2. Create parallel HTTP POST requests to each pod (with `broadcastToAll=false` to prevent recursion)
3. Wait for all requests to complete with a 10-second timeout per request
4. Aggregate results and return summary

## Security Considerations

- No authentication is required between pods (they trust each other within the namespace)
- The broadcast feature respects the same rate limits and validation as single-pod requests
- Consider using Network Policies to restrict which pods can communicate
