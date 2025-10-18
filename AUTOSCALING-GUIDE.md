# Kubernetes Autoscaling and QoS Demonstrations

This repository contains comprehensive, step-by-step demonstrations of Kubernetes autoscaling (VPA and HPA) and Quality of Service (QoS) classes using a demo application.

## Overview

Learn how to:
- **Vertically scale** pods with VPA (Vertical Pod Autoscaler)
- **Horizontally scale** pods with HPA (Horizontal Pod Autoscaler)
- **Prioritize evictions** under resource pressure using QoS classes
- **Combine strategies** for optimal resource utilization

## Repository Structure

```
k8s/
├── hpa/                    # Horizontal Pod Autoscaler demonstrations
│   ├── step-01-base-workload.yaml
│   ├── step-02-hpa-cpu.yaml
│   ├── step-03-hpa-cpu-memory.yaml
│   ├── step-04-hpa-custom-metric.yaml
│   ├── step-05-hpa-behavior.yaml
│   └── step-06-cleanup.yaml
│
├── vpa/                    # Vertical Pod Autoscaler demonstrations
│   ├── README.md          # Complete VPA tutorial
│   ├── step-01-base-workload.yaml
│   ├── step-02-vpa-off-mode.yaml
│   ├── step-03-vpa-initial-mode.yaml
│   ├── step-04-vpa-auto-mode.yaml
│   ├── step-05-vpa-recreate-mode.yaml
│   ├── step-06-vpa-tight-bounds.yaml
│   └── step-07-cleanup.yaml
│
├── qos/                    # Quality of Service demonstrations
│   ├── README.md          # Complete QoS tutorial
│   ├── step-01-guaranteed-qos.yaml
│   ├── step-02-burstable-qos.yaml
│   ├── step-03-besteffort-qos.yaml
│   ├── step-04-mixed-qos-eviction-demo.yaml
│   ├── step-05-priority-classes.yaml
│   └── step-06-cleanup.yaml
│
└── combined/               # Combined demonstrations
    ├── README.md          # How to combine VPA, HPA, and QoS
    ├── step-01-hpa-with-guaranteed-qos.yaml
    ├── step-02-vpa-with-burstable-qos.yaml
    ├── step-03-complete-demo.yaml
    └── step-04-cleanup.yaml
```

## Quick Start

### Prerequisites

- Kubernetes cluster (1.25+)
- kubectl configured
- Metrics server installed
- VPA installed (for VPA demos)

### 1. HPA Demonstrations (CPU-bound scaling)

```bash
# Start with base workload
kubectl apply -f k8s/hpa/step-01-base-workload.yaml

# Apply CPU-based HPA
kubectl apply -f k8s/hpa/step-02-hpa-cpu.yaml

# Generate load and watch scaling
kubectl port-forward svc/k8s-demo-app 8080:80
curl -X POST http://localhost:8080/api/stress/cpu \
  -H "Content-Type: application/json" \
  -d '{"minutes": 5, "threads": 8}'

# Watch HPA in action
kubectl get hpa k8s-demo-app -w
```

### 2. VPA Demonstrations (Request optimization)

```bash
# Deploy base workload with low requests
kubectl apply -f k8s/vpa/step-01-base-workload.yaml

# Enable VPA in "Off" mode (recommendations only)
kubectl apply -f k8s/vpa/step-02-vpa-off-mode.yaml

# Check recommendations
kubectl describe vpa k8s-demo-app-vpa

# Enable auto mode for live updates
kubectl apply -f k8s/vpa/step-04-vpa-auto-mode.yaml
```

### 3. QoS Demonstrations (Eviction priority)

```bash
# Deploy all three QoS classes
kubectl apply -f k8s/qos/step-04-mixed-qos-eviction-demo.yaml

# View QoS classes
kubectl get pods -n qos-demo -o custom-columns=\
NAME:.metadata.name,\
QOS:.status.qosClass

# Generate memory pressure and watch evictions
kubectl get pods -n qos-demo -w
```

### 4. Combined Demo (Everything together)

```bash
# Deploy complete demonstration
kubectl apply -f k8s/combined/step-03-complete-demo.yaml

# View all resources
kubectl get all,hpa,vpa -n autoscaling-demo
```

## Feature Comparisons

### HPA vs VPA

| Feature | HPA | VPA |
|---------|-----|-----|
| **Scaling Direction** | Horizontal (replicas) | Vertical (resources) |
| **Triggers** | CPU, Memory, Custom metrics | Historical usage patterns |
| **Pod Impact** | No pod restart | Pod restart (Auto/Recreate mode) |
| **Response Time** | Fast (seconds to minutes) | Slower (hours to days for accuracy) |
| **Best For** | CPU-bound, stateless apps | Memory-bound, stateful apps |
| **Conflicts** | Don't use both for same resource | Don't use both for same resource |

### QoS Classes

| Class | Criteria | Priority | Eviction Order | Use Case |
|-------|----------|----------|----------------|----------|
| **Guaranteed** | requests == limits | Highest | Last | Critical services, databases |
| **Burstable** | requests < limits | Medium | Second | Standard applications |
| **BestEffort** | No requests/limits | Lowest | First | Batch jobs, dev workloads |

## Common Patterns

### Pattern 1: Critical Frontend Service

```yaml
# Guaranteed QoS + HPA for CPU scaling
resources:
  requests: {cpu: 500m, memory: 512Mi}
  limits: {cpu: 500m, memory: 512Mi}

hpa:
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilization: 60%
```

**Use Case:** API gateways, web servers, user-facing services

### Pattern 2: Memory-Intensive Backend

```yaml
# Burstable QoS + VPA for memory optimization
resources:
  requests: {cpu: 200m, memory: 256Mi}
  limits: {cpu: 1, memory: 2Gi}

vpa:
  updateMode: Auto
  controlledResources: [memory]
```

**Use Case:** Data processors, caching layers, analytics services

### Pattern 3: Batch Processing

```yaml
# BestEffort QoS, no autoscaling
resources: {}
priorityClassName: low-priority
```

**Use Case:** ETL jobs, report generation, background tasks

## Tutorials

Each directory contains a complete tutorial with step-by-step instructions:

- **[HPA Tutorial](HPA-Interactive-Tutorial.md)** - Horizontal scaling with CPU, memory, and custom metrics
- **[VPA Tutorial](k8s/vpa/README.md)** - Vertical scaling with different update modes
- **[QoS Tutorial](k8s/qos/README.md)** - Understanding eviction priorities
- **[Combined Demo](k8s/combined/README.md)** - Using VPA, HPA, and QoS together

## Demo Application

The k8s-demo-app provides built-in stress testing:

```bash
# CPU stress (triggers HPA)
curl -X POST http://localhost:8080/api/stress/cpu \
  -H "Content-Type: application/json" \
  -d '{"minutes": 5, "threads": 8}'

# Memory stress (triggers VPA recommendations or evictions)
curl -X POST http://localhost:8080/api/stress/memory \
  -H "Content-Type: application/json" \
  -d '{"minutes": 5, "targetMegabytes": 600}'

# Check status
curl http://localhost:8080/api/status
```

## Best Practices

### ✅ Do

- Use HPA for CPU-bound, stateless workloads
- Use VPA for memory-bound workloads or right-sizing
- Match QoS class to workload criticality
- Set PodDisruptionBudgets for critical services
- Monitor autoscaling metrics regularly
- Start with "Off" mode VPA to get recommendations
- Use resource limits to prevent runaway consumption

### ❌ Don't

- Use VPA + HPA on the same resource (CPU or memory)
- Run VPA in "Auto" mode without testing first
- Use BestEffort QoS for production critical services
- Set resource limits too low (causes throttling/OOM)
- Ignore VPA recommendations for extended periods
- Scale too aggressively (set appropriate stabilization windows)

## Troubleshooting

### HPA Not Scaling

1. Check metrics server: `kubectl get pods -n kube-system -l k8s-app=metrics-server`
2. Verify resource requests are set
3. Check current metrics: `kubectl describe hpa <name>`

### VPA Not Updating

1. Verify VPA is installed: `kubectl get crd | grep verticalpodautoscaler`
2. Check updateMode is not "Off"
3. Ensure no conflicting HPA on same resource

### Unexpected Evictions

1. Check node conditions: `kubectl describe nodes | grep Pressure`
2. View eviction events: `kubectl get events --field-selector reason=Evicted`
3. Review resource usage: `kubectl top nodes` and `kubectl top pods`

## Monitoring

Key metrics to track:

```bash
# Autoscaler status
kubectl get hpa,vpa --all-namespaces

# Resource usage
kubectl top nodes
kubectl top pods --all-namespaces

# Events
kubectl get events --all-namespaces --sort-by='.lastTimestamp'

# QoS distribution
kubectl get pods --all-namespaces -o custom-columns=\
NAMESPACE:.metadata.namespace,\
NAME:.metadata.name,\
QOS:.status.qosClass
```

## Additional Resources

- [Kubernetes HPA Documentation](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Kubernetes VPA GitHub](https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler)
- [QoS Classes Documentation](https://kubernetes.io/docs/tasks/configure-pod-container/quality-service-pod/)
- [Resource Management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [Pod Priority and Preemption](https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/)

## Contributing

These demonstrations are part of the k8s-demo-time repository. Contributions and improvements are welcome!

## License

See the main repository LICENSE file.
