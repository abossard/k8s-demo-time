# Combined Autoscaling and QoS Demonstrations

## Overview

This directory contains comprehensive demonstrations that combine VPA (Vertical Pod Autoscaler), HPA (Horizontal Pod Autoscaler), and QoS (Quality of Service) classes. These examples show how to use these features together to create resilient, efficient Kubernetes applications.

## Key Concepts Integration

### 1. HPA + Guaranteed QoS
- **Use Case:** Critical, CPU-bound workloads
- **Strategy:** Scale replicas horizontally based on CPU utilization
- **QoS:** Guaranteed (requests == limits) for highest eviction priority
- **Example:** Frontend web servers, API gateways

### 2. VPA + Burstable QoS
- **Use Case:** Memory-intensive workloads with variable usage patterns
- **Strategy:** Adjust memory requests vertically based on actual usage
- **QoS:** Burstable (requests < limits) for flexibility
- **Example:** Backend services, data processors

### 3. BestEffort QoS
- **Use Case:** Non-critical, batch workloads
- **Strategy:** No autoscaling, runs with available resources
- **QoS:** BestEffort (no requests/limits) for lowest priority
- **Example:** Background jobs, batch processing

## Quick Start

```bash
# Deploy complete demonstration
kubectl apply -f k8s/combined/step-03-complete-demo.yaml

# View all pods with their QoS classes
kubectl get pods -n autoscaling-demo -o custom-columns=\
NAME:.metadata.name,\
QOS:.status.qosClass,\
PRIORITY:.spec.priorityClassName

# Check autoscaling resources
kubectl get hpa,vpa -n autoscaling-demo

# Cleanup
kubectl delete -f k8s/combined/step-03-complete-demo.yaml
```

## Demonstrations

### Step 1: HPA with Guaranteed QoS

Deploy a critical frontend service that scales horizontally based on CPU load while maintaining guaranteed resources.

```bash
kubectl apply -f k8s/combined/step-01-hpa-with-guaranteed-qos.yaml
```

**Features:**
- Guaranteed QoS (requests == limits)
- HPA with CPU target of 60%
- Fast scale-up (100% increase or 2 pods per 30s)
- Conservative scale-down (50% decrease per 60s, 120s stabilization)
- Min 2 replicas, max 10 replicas

**Testing:**
```bash
# Port-forward to service
kubectl port-forward -n autoscaling-demo svc/frontend-guaranteed 8080:80

# Generate CPU load
curl -X POST http://localhost:8080/api/stress/cpu \
  -H "Content-Type: application/json" \
  -d '{"minutes": 5, "threads": 8}'

# Watch HPA scaling
kubectl get hpa -n autoscaling-demo -w
```

### Step 2: VPA with Burstable QoS

Deploy a backend service that adjusts memory requests based on usage while allowing bursts.

```bash
kubectl apply -f k8s/combined/step-02-vpa-with-burstable-qos.yaml
```

**Features:**
- Burstable QoS (requests < limits)
- VPA controls memory resources only
- Auto update mode (recreates pods when needed)
- Min 128Mi, max 2Gi memory
- 3 replicas for redundancy during VPA updates

**Testing:**
```bash
# Port-forward to service
kubectl port-forward -n autoscaling-demo svc/backend-burstable 8080:80

# Generate memory load
curl -X POST http://localhost:8080/api/stress/memory \
  -H "Content-Type: application/json" \
  -d '{"minutes": 10, "targetMegabytes": 600}'

# Check VPA recommendations
kubectl describe vpa -n autoscaling-demo backend-burstable-vpa
```

### Step 3: Complete Demo (All Together)

Deploy all three workload types demonstrating different QoS classes with appropriate autoscaling strategies.

```bash
kubectl apply -f k8s/combined/step-03-complete-demo.yaml
```

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    Autoscaling Demo                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Critical Frontend (Guaranteed + HPA)                        │
│  ├─ QoS: Guaranteed (500m CPU = 500m, 512Mi = 512Mi)       │
│  ├─ Priority: High (1000000)                                 │
│  ├─ Autoscaling: HPA CPU-based (60% target)                 │
│  └─ Replicas: 2-10                                           │
│                                                               │
│  Standard Backend (Burstable + VPA)                          │
│  ├─ QoS: Burstable (200m-1 CPU, 256Mi-1Gi)                 │
│  ├─ Priority: Medium (500000)                                │
│  ├─ Autoscaling: VPA memory-based                           │
│  └─ Replicas: 3 (fixed)                                      │
│                                                               │
│  Batch Worker (BestEffort, no autoscaling)                   │
│  ├─ QoS: BestEffort (no requests/limits)                    │
│  ├─ Priority: Low (100000)                                   │
│  ├─ Autoscaling: None                                        │
│  └─ Replicas: 2 (fixed)                                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**View all resources:**
```bash
# List all deployments with QoS
kubectl get deployments -n autoscaling-demo -o custom-columns=\
NAME:.metadata.name,\
REPLICAS:.spec.replicas,\
QOS:.metadata.labels.qos,\
TIER:.metadata.labels.tier

# View autoscaling configurations
kubectl get hpa,vpa -n autoscaling-demo

# Check priority classes
kubectl get priorityclass
```

**Testing Eviction Priority:**
```bash
# Generate memory pressure on all tiers
# BestEffort pods will be evicted first

# Port-forward to each service (in separate terminals)
kubectl port-forward -n autoscaling-demo svc/critical-frontend 8081:80 &
kubectl port-forward -n autoscaling-demo svc/standard-backend 8082:80 &
kubectl port-forward -n autoscaling-demo svc/batch-worker 8083:80 &

# Apply memory stress to all
curl -X POST http://localhost:8083/api/stress/memory \
  -H "Content-Type: application/json" \
  -d '{"minutes": 10, "targetMegabytes": 500}'  # BestEffort

curl -X POST http://localhost:8082/api/stress/memory \
  -H "Content-Type: application/json" \
  -d '{"minutes": 10, "targetMegabytes": 700}'  # Burstable

curl -X POST http://localhost:8081/api/stress/memory \
  -H "Content-Type: application/json" \
  -d '{"minutes": 10, "targetMegabytes": 400}'  # Guaranteed

# Monitor evictions
kubectl get pods -n autoscaling-demo -w
kubectl get events -n autoscaling-demo --sort-by='.lastTimestamp' | grep -i evict
```

### Step 4: Cleanup

```bash
kubectl delete -f k8s/combined/step-03-complete-demo.yaml
```

## Best Practices

### 1. **Never use VPA + HPA on the same resource**

❌ **Bad:**
```yaml
# Both targeting CPU on same deployment
HPA: cpu target 60%
VPA: controlledResources: [cpu, memory]
```

✅ **Good:**
```yaml
# HPA for CPU, VPA for memory
HPA: cpu target 60%
VPA: controlledResources: [memory]
```

Or separate entirely:
```yaml
# Different deployments
frontend: HPA only (CPU-bound)
backend: VPA only (memory-bound)
```

### 2. **Match QoS to workload criticality**

```yaml
# Critical services → Guaranteed
critical-api:
  priorityClassName: high-priority
  resources:
    requests: {cpu: 1, memory: 1Gi}
    limits: {cpu: 1, memory: 1Gi}

# Standard services → Burstable
standard-app:
  priorityClassName: medium-priority
  resources:
    requests: {cpu: 200m, memory: 256Mi}
    limits: {cpu: 2, memory: 2Gi}

# Batch jobs → BestEffort
batch-job:
  priorityClassName: low-priority
  resources: {}
```

### 3. **Use appropriate HPA behavior**

```yaml
# Fast scale-up for responsive services
behavior:
  scaleUp:
    stabilizationWindowSeconds: 30
    policies:
      - type: Percent
        value: 100  # Double replicas
        periodSeconds: 30

# Slow scale-down to prevent flapping
  scaleDown:
    stabilizationWindowSeconds: 300  # 5 minute observation
    policies:
      - type: Percent
        value: 50  # Reduce by half
        periodSeconds: 60
```

### 4. **Set VPA bounds appropriately**

```yaml
resourcePolicy:
  containerPolicies:
    - containerName: app
      minAllowed:
        memory: "256Mi"  # Prevent too-small requests
      maxAllowed:
        memory: "2Gi"    # Prevent runaway growth
```

### 5. **Use PodDisruptionBudgets with autoscaling**

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: frontend-pdb
spec:
  minAvailable: 1  # Always keep at least 1 replica
  selector:
    matchLabels:
      app: critical-frontend
```

## Monitoring

### View Autoscaling Status

```bash
# HPA status
kubectl get hpa -n autoscaling-demo -w

# VPA recommendations
kubectl describe vpa -n autoscaling-demo

# Resource usage
kubectl top pods -n autoscaling-demo

# Events
kubectl get events -n autoscaling-demo --sort-by='.lastTimestamp'
```

### Key Metrics to Monitor

1. **HPA:**
   - Current replicas vs desired replicas
   - Current CPU/memory utilization vs target
   - Scale up/down events

2. **VPA:**
   - Current requests vs recommendations
   - Recommendation confidence
   - Pod restart frequency

3. **QoS:**
   - Eviction events by QoS class
   - Node memory pressure
   - OOMKilled events

## Troubleshooting

### HPA Not Scaling

```bash
# Check metrics server
kubectl get pods -n kube-system -l k8s-app=metrics-server

# Verify resource requests are set
kubectl describe deployment -n autoscaling-demo | grep -A 5 "Requests:"

# Check HPA status
kubectl describe hpa -n autoscaling-demo
```

### VPA Not Updating Pods

```bash
# Check VPA status
kubectl describe vpa -n autoscaling-demo

# Verify updateMode is not "Off"
kubectl get vpa -n autoscaling-demo -o yaml | grep updateMode

# Check for conflicting HPA
kubectl get hpa -n autoscaling-demo
```

### Unexpected Evictions

```bash
# Check node conditions
kubectl describe nodes | grep -A 5 "Conditions:"

# View eviction events
kubectl get events --all-namespaces --field-selector reason=Evicted

# Check resource pressure
kubectl top nodes
```

## Additional Resources

- [HPA Documentation](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [VPA Documentation](https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler)
- [QoS Classes](https://kubernetes.io/docs/tasks/configure-pod-container/quality-service-pod/)
- [Resource Management Best Practices](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
