# Kubernetes Demo Tutorials

A hands-on tutorial collection for learning Kubernetes resource management, autoscaling, networking, and cost optimization using a purpose-built demo application.

## Demo Application

**k8s-demo-app** is a .NET 9.0 Web API with built-in tools for exploring Kubernetes concepts:

- **Stress endpoints** — Generate CPU and memory load to trigger autoscaling
- **Probe management** — Toggle startup, readiness, and liveness probes live
- **Chaos engineering** — Simulate crashes and request freezes
- **Prometheus metrics** — `/metrics` endpoint for custom metric scaling (KEDA)
- **QoS detection** — Displays the pod's current QoS class
- **Live dashboard** — Real-time SSE-based status with per-pod color theming
- **Broadcast coordination** — Coordinate actions across replicas via headless service DNS

## Recommended Learning Path

Follow these tutorials in order — each builds on concepts from the previous:

| # | Tutorial | Focus | Duration |
|---|----------|-------|----------|
| 1 | **[Resource Management](k8s/resources/README.md)** | Requests, limits, CPU throttling, OOM kills | ~45 min |
| 2 | **[Scaling Journey](k8s/scaling-journey/README.md)** | HPA → Custom Metrics → KEDA → VPA (unified) | ~2–3 hrs |
| 3 | **[QoS Classes](k8s/qos/README.md)** | Guaranteed, Burstable, BestEffort, eviction priority | ~30 min |
| 4 | **[VPA Deep Dive](k8s/vpa/README.md)** | Off → Initial → Recreate → InPlaceOrRecreate modes | ~45 min |
| 5 | **[Bin Packing](k8s/bin-packing/README.md)** | Cost optimization vs stability trade-offs (7 iterations) | ~1 hr |
| 6 | **[Cilium & Hubble](k8s/cilium/README.md)** | Network observability, DNS, L7 policies, eBPF | ~1 hr |

## Repository Structure

```
k8s/
├── resources/              # Foundation: requests, limits, resource lifecycle
├── scaling-journey/        # Unified autoscaling: HPA → KEDA → VPA
├── qos/                    # QoS classes and eviction priority
├── vpa/                    # Vertical Pod Autoscaler deep dive
├── bin-packing/            # Cost optimization strategies (7 steps)
├── cilium/                 # Cilium CNI & Hubble network observability
└── deployment.yaml         # Base deployment manifest

src/K8sDemoApp/             # Demo application source
infra/                      # Azure Bicep templates (AKS, ACR)
```

## Quick Start

```bash
# 1. Build and deploy the demo app
cd src/K8sDemoApp && dotnet build && cd ../..
docker build --platform linux/amd64 -t k8s-demo-app:local .

# 2. Start with Resource Management fundamentals
kubectl apply -f k8s/resources/step-01-no-resources.yaml

# 3. Access the dashboard
kubectl port-forward svc/k8s-demo-app 8080:80 -n resources-demo
open http://localhost:8080
```

## Feature Comparison

### HPA vs VPA vs KEDA

| Feature | HPA | VPA | KEDA |
|---------|-----|-----|------|
| **Scaling Direction** | Horizontal (replicas) | Vertical (resources) | Horizontal (replicas) |
| **Triggers** | CPU, memory | Historical usage | Any event source (Prometheus, queues, HTTP, cron, …) |
| **Pod Impact** | No restart | Pod restart (Recreate mode) | No restart |
| **Response Time** | Seconds–minutes | Hours–days for accuracy | Seconds–minutes |
| **Scale to Zero** | No (min 1) | N/A | ✅ Yes |
| **Best For** | CPU-bound stateless apps | Right-sizing, memory-bound | Event-driven, queue-based |
| **Conflicts** | Don't overlap with VPA on same metric | Don't overlap with HPA on same metric | Manages HPA; same VPA rules apply |

### QoS Classes

| Class | Criteria | Eviction Order | Use Case |
|-------|----------|----------------|----------|
| **Guaranteed** | requests == limits | Last (highest priority) | Critical services, databases |
| **Burstable** | requests < limits | Second | Standard applications |
| **BestEffort** | No requests/limits | First (lowest priority) | Batch jobs, dev workloads |

## Prerequisites

- **Kubernetes cluster** 1.25+ (AKS recommended — see `infra/`)
- **kubectl** configured for your cluster
- **Metrics Server** installed (`kubectl top nodes` should work)
- **Helm 3** (for Prometheus/KEDA in scaling-journey)
- **VPA** installed (for VPA and bin-packing tutorials)
- **KEDA** enabled as AKS managed addon (for scaling-journey KEDA steps)
- **Cilium CNI** with Hubble (for cilium tutorial — default on AKS)

## Best Practices

### ✅ Do

- Always set resource requests — the scheduler needs them
- Use HPA for CPU-bound, stateless workloads
- Use VPA for right-sizing and memory-bound workloads
- Use KEDA for event-driven and queue-based scaling
- Match QoS class to workload criticality
- Set PodDisruptionBudgets for critical services
- Start with VPA "Off" mode to collect recommendations before enabling auto-updates
- Use Prometheus metrics for scaling decisions beyond CPU/memory

### ❌ Don't

- Use VPA + HPA on the **same metric** (CPU or memory)
- Run VPA in auto-update mode without testing in Off mode first
- Use BestEffort QoS for production-critical services
- Set resource limits too low (causes CPU throttling / OOM kills)
- Ignore VPA recommendations — they drift over time
- Scale too aggressively (set appropriate stabilization windows)
- Skip resource requests — pods become BestEffort and get evicted first

## Troubleshooting

### HPA Not Scaling

1. Check metrics server: `kubectl get pods -n kube-system -l k8s-app=metrics-server`
2. Verify resource **requests** are set (HPA needs them for percentage calculation)
3. Inspect HPA status: `kubectl describe hpa <name> -n <namespace>`
4. Check for `ScalingLimited` or `FailedGetResourceMetric` conditions

### KEDA Not Scaling

1. Verify KEDA operator is running: `kubectl get pods -n kube-system -l app=keda-operator`
2. Check ScaledObject status: `kubectl describe scaledobject <name> -n <namespace>`
3. Confirm Prometheus is reachable from the KEDA metrics server
4. Check trigger query returns data: test the PromQL query manually

### VPA Not Updating

1. Verify VPA CRDs: `kubectl get crd | grep verticalpodautoscaler`
2. Check updateMode is not "Off" (Off = recommendations only)
3. Ensure no conflicting HPA targeting the same resource
4. Review recommendations: `kubectl describe vpa <name> -n <namespace>`

### Unexpected Evictions

1. Check node pressure: `kubectl describe nodes | grep -A5 Conditions`
2. View eviction events: `kubectl get events --field-selector reason=Evicted`
3. Review resource usage: `kubectl top nodes && kubectl top pods -A`
4. Check QoS classes: pods without requests/limits are evicted first

## Additional Resources

- [Kubernetes HPA Documentation](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Kubernetes VPA GitHub](https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler)
- [KEDA Documentation](https://keda.sh/docs/)
- [QoS Classes Documentation](https://kubernetes.io/docs/tasks/configure-pod-container/quality-service-pod/)
- [Resource Management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [Cilium Documentation](https://docs.cilium.io/)
- [Hubble Observability](https://docs.cilium.io/en/stable/observability/)
