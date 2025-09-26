# Kubernetes HPA Interactive Tutorial

## Audience & Prereqs
- Comfortable with `kubectl`, Deployments, and Services
- Metrics server installed and ready to scrape cluster metrics
- Access to the demo app namespace with ability to deploy manifests

## Lab Flow

### 1. Verify Environment (15 min)
- Confirm metrics server is healthy with `kubectl get deployment metrics-server -n kube-system`.
- Deploy the base workload from `k8s/deployment.yaml` and ensure two pods reach `Ready` state.
- Open the dashboard (`kubectl port-forward svc/k8s-demo-app 8080:80`) to monitor live metrics.

### 2. Create a CPU Target HPA (25 min)
- Walk through the HPA YAML, highlighting `minReplicas`, `maxReplicas`, and CPU utilization target.
- Apply the manifest, then describe the HPA to review current metrics and scaling thresholds.
- Trigger CPU load through the dashboard or `curl` to `/api/stress/cpu` and watch replicas scale out.

### 3. Add Memory Metrics (20 min)
- Patch the HPA to include a memory utilization target alongside CPU.
- Use `/api/stress/memory` to simulate pressure; observe stabilization delay and scale-in timing.
- Discuss trade-offs of memory-based scaling in workloads with GC or caching behaviour.

### 4. Introduce Custom Metrics (30 min)
- Enable or point to a Prometheus Adapter that exposes custom metrics (e.g., request backlog).
- Register a sample metric and update the HPA to include it with `type: Object` or `Pods` metric type.
- Use a scripted load (e.g., `hey` or `wrk`) to produce backlog and correlate with HPA decisions.

### 5. Tune Behavior Policies (20 min)
- Demonstrate `behavior.scaleUp` and `behavior.scaleDown` policies to control surge and cooldown.
- Experiment with aggressive vs. conservative policies and note replica counts over time.

### 6. Wrap-Up & Cleanup (10 min)
- Review `kubectl get hpa -w` output and identify key signals for production monitoring.
- Remove tutorial resources, leaving the cluster in the original state.

## Optional Extensions
- Combine with Vertical Pod Autoscaler and evaluate admission recalculation conflicts.
- Pair the HPA with PodDisruptionBudgets and discuss how they influence rollouts and auto-scaling.
- Stress the cluster node pool to illustrate interactions with Cluster Autoscaler.
