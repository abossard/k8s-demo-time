# Kubernetes Resources: Understanding What Your Pods Need and What Your Nodes Have

> **Prerequisites:** A running AKS cluster with metrics-server and Karpenter (node autoprovisioner).
> This tutorial is the **foundation** — complete it before diving into [QoS Classes](../qos/), [VPA](../vpa/), or [Bin Packing](../bin-packing/).

## The Story

You deploy an app. It works. You celebrate. Then one morning, your pods are `Pending`. Another day, they're `OOMKilled`. Your deployment says 3 replicas but only 2 are running. Your app is slow even though the node has free CPU.

**Why?** Because you don't understand resources.

This tutorial will fix that. By the end, you'll know exactly how Kubernetes decides where to place your pods, what happens when they use too much, and how to set the right values from the start.

---

## What Are Resource Requests and Limits?

Every container in Kubernetes can declare two things about CPU and memory:

| Concept | What It Means | Who Enforces It |
|---------|--------------|-----------------|
| **Request** | "I need *at least* this much to run" | The **scheduler** — uses this to pick a node |
| **Limit** | "I must *never* exceed this much" | The **kubelet/kernel** — kills or throttles if exceeded |

```yaml
resources:
  requests:        # Guaranteed minimum
    cpu: "200m"    # 200 millicores = 0.2 CPU cores
    memory: "256Mi"
  limits:          # Hard ceiling
    cpu: "500m"    # Can burst up to 0.5 cores
    memory: "512Mi"
```

### CPU vs Memory: Different Enforcement

| Resource | What Happens at the Limit? | Consequence |
|----------|---------------------------|-------------|
| **CPU** | Container is **throttled** | App gets slower, but keeps running |
| **Memory** | Container is **OOM-killed** | Process is terminated (exit code 137) |

This asymmetry is crucial: CPU overuse is annoying, memory overuse is fatal.

### The Resource Lifecycle

```
Deploy Pod
    │
    ▼
┌─────────────────┐
│ Scheduler checks │ ← "Does any node have enough ALLOCATABLE
│ resource REQUESTS │    resources to satisfy this pod's REQUESTS?"
└────────┬────────┘
         │
    ┌────┴────┐
    │ Yes     │ No → Pod stays Pending (FailedScheduling)
    ▼         │
┌────────┐    │
│ Placed │    │
│ on Node│    │
└───┬────┘    │
    │         │
    ▼         │
┌──────────────┐
│ Pod runs     │ ← Actual usage can be anywhere between
│ uses resources│   0 and the LIMIT
└───┬──────────┘
    │
    ├─── CPU > limit? → Throttled (slower, not killed)
    │
    ├─── Memory > limit? → OOMKilled (exit code 137)
    │
    └─── Node under memory pressure? → Evicted (BestEffort first)
```

### Resource Units Quick Reference

| Unit | Meaning | Example |
|------|---------|---------|
| `1` | 1 full CPU core | A whole core |
| `500m` | 500 millicores = 0.5 cores | Half a core |
| `100m` | 100 millicores = 0.1 cores | A tenth of a core |
| `1Gi` | 1 gibibyte (1024³ bytes) | Use for memory |
| `256Mi` | 256 mebibytes | Common container size |
| `64Mi` | 64 mebibytes | Minimal container |

> ⚠️ **Common mistake:** `1G` (gigabyte, 10⁹) vs `1Gi` (gibibyte, 2³⁰). Always use `Mi`/`Gi` in Kubernetes.

---

## 🔍 Step 1: Deploy and Observe

**Goal:** Deploy a standard workload and learn to read resource information from multiple sources.

### Apply the Manifest

```bash
kubectl apply -f k8s/resources/step-01-observe.yaml
```

This creates:
- Namespace `resources-demo`
- Deployment `demo-app` with 2 replicas (requests: 200m/256Mi, limits: 500m/512Mi)
- LoadBalancer service + headless service for pod discovery

Wait for pods to be ready:

```bash
kubectl wait --for=condition=Ready pods --all -n resources-demo --timeout=120s
```

### Read Resource Info from kubectl

**What are the pods using right now?**
```bash
kubectl top pods -n resources-demo
```
```
NAME                        CPU(cores)   MEMORY(bytes)
demo-app-7d8f9c6b4-abc12   3m           45Mi
demo-app-7d8f9c6b4-def34   2m           43Mi
```

The pods request 200m CPU but only use ~3m at idle. That's a **66x overcommit** — the gap between what you reserved and what you actually use.

**What do the nodes have?**
```bash
kubectl top nodes
```

**What's committed (allocated) on each node?**
```bash
kubectl describe node $(kubectl get nodes -o jsonpath='{.items[0].metadata.name}') \
  | grep -A 20 "Allocated resources"
```
```
Allocated resources:
  Resource           Requests      Limits
  --------           --------      ------
  cpu                830m (43%)    1500m (78%)
  memory             768Mi (27%)   1536Mi (55%)
```

**See pod resource configuration at a glance:**
```bash
kubectl get pods -n resources-demo -o custom-columns=\
NAME:.metadata.name,\
QOS:.status.qosClass,\
CPU-REQ:.spec.containers[0].resources.requests.cpu,\
CPU-LIM:.spec.containers[0].resources.limits.cpu,\
MEM-REQ:.spec.containers[0].resources.requests.memory,\
MEM-LIM:.spec.containers[0].resources.limits.memory
```
```
NAME                        QOS        CPU-REQ   CPU-LIM   MEM-REQ   MEM-LIM
demo-app-7d8f9c6b4-abc12   Burstable  200m      500m      256Mi     512Mi
demo-app-7d8f9c6b4-def34   Burstable  200m      500m      256Mi     512Mi
```

### Read Resource Info from the App

The demo app knows its own resource configuration (injected via the Downward API):

```bash
kubectl port-forward svc/demo-app 8080:80 -n resources-demo &

# Dashboard with QoS badge
open http://localhost:8080

# Prometheus metrics — actual process-level usage
curl -s http://localhost:8080/metrics | grep -E "process_resident_memory|process_cpu_seconds"
```

### Three Numbers That Tell the Whole Story

For each pod, there are three resource numbers:

| Number | Source | What It Means |
|--------|--------|---------------|
| **Request** | Pod spec | What the scheduler reserved on the node |
| **Actual** | `kubectl top` / metrics | What the container is actually consuming right now |
| **Limit** | Pod spec | The hard ceiling — exceed memory and you die |

The gap between **request** and **actual** is wasted capacity (reserved but unused).
The gap between **actual** and **limit** is burst headroom (available but not guaranteed).

```
0        Request    Actual        Limit
├──────────┤..........├──────────────┤
  Reserved     Idle      Burst Room
  (wasted)   (usage)    (not guaranteed)
```

> 💡 **Key insight:** The scheduler only looks at *requests*. It doesn't know or care about actual usage. You could request 4 CPU and use 0.001 — the scheduler still blocks 4 CPU on that node.

---

## 📊 Step 2: Node Capacity Deep Dive

**Goal:** Understand the four capacity numbers that determine whether your pod can be scheduled.

No YAML needed — this is a `kubectl` investigation.

### The Four Numbers That Matter

Every node has a resource pipeline:

```
┌─────────────────────────────────────────────────────┐
│                    Total Capacity                    │
│  (What the VM/hardware actually has)                 │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │              Allocatable                       │  │
│  │  (Capacity minus system reserved)              │  │
│  │                                                │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │           Allocated (Requested)          │  │  │
│  │  │  (Sum of all pod requests on this node)  │  │  │
│  │  │                                          │  │  │
│  │  │  ┌───────────────────────────────────┐  │  │  │
│  │  │  │        Actual Usage               │  │  │  │
│  │  │  │  (What pods are really using)     │  │  │  │
│  │  │  └───────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Check Capacity vs Allocatable

```bash
kubectl get nodes -o custom-columns=\
NAME:.metadata.name,\
CPU-CAP:.status.capacity.cpu,\
CPU-ALLOC:.status.allocatable.cpu,\
MEM-CAP:.status.capacity.memory,\
MEM-ALLOC:.status.allocatable.memory
```
```
NAME                    CPU-CAP   CPU-ALLOC   MEM-CAP      MEM-ALLOC
aks-nodepool1-abc123    2         1920m       4Gi          2856Mi
```

Notice: a "2 CPU" node only has 1920m allocatable — 80m is reserved for the kubelet, kube-proxy, and OS.

### Check What's Already Scheduled

```bash
kubectl describe nodes | grep -A 20 "Allocated resources:"
```

This shows the sum of all pod *requests* on each node — not actual usage.

### Check Node Health (Pressure Signals)

```bash
kubectl get nodes -o custom-columns=\
NAME:.metadata.name,\
MEM-PRESSURE:.status.conditions[?(@.type==\"MemoryPressure\")].status,\
DISK-PRESSURE:.status.conditions[?(@.type==\"DiskPressure\")].status,\
PID-PRESSURE:.status.conditions[?(@.type==\"PIDPressure\")].status
```

When pressure conditions flip to `True`, the kubelet starts **evicting** pods (BestEffort first, then Burstable exceeding requests, then Guaranteed).

### Why This Matters for Scheduling

The scheduler's decision is simple:

```
Can this pod be scheduled?
= Is there a node where:
    (sum of existing pod REQUESTS) + (new pod's REQUESTS) ≤ node ALLOCATABLE?
```

It does NOT check:
- ❌ Actual current usage
- ❌ Limits
- ❌ How much memory the app "usually" needs

Only requests matter for scheduling. This is why getting requests right is so important.

---

## 🚫 Step 3: The Unschedulable Pod

**Goal:** See what happens when you request more resources than any node can provide.

### Deploy the Greedy Pod

```bash
kubectl apply -f k8s/resources/step-03-unschedulable.yaml
```

This creates a deployment requesting **8 CPU and 32Gi memory** — far more than any node in the cluster.

### Watch It Stay Pending

```bash
kubectl get pods -n resources-demo -l app=demo-app-greedy
```
```
NAME                              READY   STATUS    RESTARTS   AGE
demo-app-greedy-5b9f8d7c6-xyz99  0/1     Pending   0          30s
```

### Diagnose the Problem

```bash
kubectl describe pod -l app=demo-app-greedy -n resources-demo | tail -20
```
```
Events:
  Type     Reason            Age   From               Message
  ----     ------            ----  ----               -------
  Warning  FailedScheduling  10s   default-scheduler  0/3 nodes are available:
    3 Insufficient cpu, 3 Insufficient memory.
    preemption: 0/3 nodes are available: 3 No preemption victims found...
```

Or query events directly:
```bash
kubectl get events -n resources-demo --field-selector reason=FailedScheduling
```

### 🤔 How Do You Fix an Unschedulable Pod?

| Fix | When to Use |
|-----|-------------|
| **Reduce requests** | Your app doesn't actually need that much |
| **Karpenter provisions new node** | Requests are reasonable; cluster just needs to grow |
| **Remove other workloads** | Free up space on existing nodes |
| **Use node affinity** | Target nodes with more capacity (GPU nodes, high-mem pools) |

### Fix It

Delete the greedy deployment — the app doesn't actually need 8 CPUs:

```bash
kubectl delete deployment demo-app-greedy -n resources-demo
```

> 💡 **With Karpenter:** If you request something reasonable (e.g., 4 CPU/8Gi), Karpenter will automatically provision a larger node to fit it. It won't provision a node for truly unreasonable requests that exceed available VM SKUs.

---

## 💀 Step 4: Memory Pressure and OOMKill

**Goal:** Experience the difference between a running pod and a dead one — caused by exceeding a memory limit.

### Deploy the Tight-Memory Pod

```bash
kubectl apply -f k8s/resources/step-04-memory-pressure.yaml
```

This creates a pod with **64Mi request / 128Mi limit** — the app idles at ~50-80Mi, so it starts fine.

Wait for it to be ready:
```bash
kubectl wait --for=condition=Ready pods -l app=demo-app-tight -n resources-demo --timeout=120s
```

### Trigger the OOMKill

```bash
kubectl port-forward svc/demo-app-tight 9090:80 -n resources-demo &

# Tell the app to allocate 200Mi of memory — exceeding the 128Mi limit
curl -X POST http://localhost:9090/api/stress/memory \
  -H "Content-Type: application/json" \
  -d '{"minutes": 2, "targetMegabytes": 200}'
```

### Watch It Die

In another terminal:
```bash
kubectl get pods -n resources-demo -l app=demo-app-tight -w
```
```
NAME                              READY   STATUS    RESTARTS   AGE
demo-app-tight-6f9d8c7b5-abc12   1/1     Running   0          60s
demo-app-tight-6f9d8c7b5-abc12   0/1     OOMKilled 0          75s
demo-app-tight-6f9d8c7b5-abc12   1/1     Running   1          80s
```

### Inspect the Corpse

```bash
kubectl describe pod -l app=demo-app-tight -n resources-demo | grep -A 10 "Last State"
```
```
    Last State:  Terminated
      Reason:    OOMKilled
      Exit Code: 137
      ...
```

**Exit code 137** = 128 + 9 (SIGKILL). The Linux kernel's OOM killer terminated the process.

### OOMKill vs Eviction — Different Mechanisms!

| Mechanism | Trigger | Who Does It | Scope | Restart? |
|-----------|---------|-------------|-------|----------|
| **OOMKill** | Container exceeds its memory **limit** | Linux kernel | Single container | Yes (per restart policy) |
| **Eviction** | Node is under memory **pressure** | Kubelet | Entire pod | Rescheduled to another node |

OOMKill is surgical (just the container). Eviction is wholesale (the whole pod gets kicked off the node).

### 🤔 Should You Increase the Limit or Optimize the App?

**Increase the limit when:**
- The app legitimately needs more memory for its workload
- The limit was set too conservatively
- The memory usage is temporary (cache warming, batch processing)

**Optimize the app when:**
- There's a memory leak
- The app caches too aggressively
- Data structures could be more efficient
- You're loading entire datasets into memory

**Use VPA when:**
- You're not sure what the right values are
- Usage patterns change over time
- See the [VPA tutorial](../vpa/) for automatic right-sizing

### Clean Up Step 4

```bash
kubectl delete deployment demo-app-tight -n resources-demo
kubectl delete service demo-app-tight demo-app-tight-headless -n resources-demo
```

---

## 📏 Step 5: Resource Quotas and LimitRanges

**Goal:** Learn how cluster admins protect namespaces from runaway resource consumption.

### First, Clean Up Existing Deployments

Quotas cap total namespace resources, so we need to clear previous deployments:

```bash
kubectl delete deployment demo-app -n resources-demo
kubectl delete service demo-app demo-app-headless -n resources-demo
```

### Apply Quotas and LimitRanges

```bash
kubectl apply -f k8s/resources/step-05-quotas.yaml
```

This creates:
- **ResourceQuota** `resource-budget`: max 2 CPU requests, 2Gi memory requests, 6 pods total
- **LimitRange** `default-limits`: default 200m/256Mi per container, max 1 CPU/1Gi per container
- **Deployment** `demo-app-quota-test`: 3 replicas to test within quota

### Inspect the Quota

```bash
kubectl describe resourcequota resource-budget -n resources-demo
```
```
Name:             resource-budget
Namespace:        resources-demo
Resource          Used    Hard
--------          ----    ----
limits.cpu        1500m   4
limits.memory     1536Mi  4Gi
pods              3       6
requests.cpu      600m    2
requests.memory   768Mi   2Gi
```

### Inspect the LimitRange

```bash
kubectl describe limitrange default-limits -n resources-demo
```
```
Type        Resource  Min   Max   Default  Default Request
----        --------  ---   ---   -------  ---------------
Container   cpu       50m   1     200m     100m
Container   memory    64Mi  1Gi   256Mi    128Mi
```

The LimitRange does two things:
1. **Injects defaults** — pods without resource specs get `100m/128Mi` requests and `200m/256Mi` limits
2. **Enforces caps** — no single container can request more than `1 CPU / 1Gi`

### Try to Exceed the Quota

```bash
# Scale to 8 replicas — quota only allows 6 pods
kubectl scale deployment demo-app-quota-test --replicas=8 -n resources-demo
```

```bash
# Some pods won't be created
kubectl get pods -n resources-demo -l app=demo-app-quota-test
kubectl get events -n resources-demo --field-selector reason=FailedCreate | head -5
```
```
Error creating: pods "demo-app-quota-test-xxx" is forbidden:
exceeded quota: resource-budget, requested: requests.cpu=200m,requests.memory=256Mi,
used: requests.cpu=1200m,requests.memory=1536Mi, limited: requests.cpu=2,requests.memory=2Gi
```

### When to Use Quotas

| Scenario | Use Quotas? |
|----------|-------------|
| Multi-team cluster | ✅ Prevent one team from consuming everything |
| Dev/staging environments | ✅ Cap costs and prevent runaway deployments |
| Single-app cluster | ❌ Usually unnecessary overhead |
| With Karpenter | ⚠️ Karpenter scales nodes, but quotas still limit namespace totals |

### Clean Up Step 5

```bash
kubectl delete deployment demo-app-quota-test -n resources-demo
kubectl delete resourcequota resource-budget -n resources-demo
kubectl delete limitrange default-limits -n resources-demo
```

---

## 🔧 Step 6: Practical Resource Tuning

**Goal:** Learn the process for setting the *right* resource requests and limits.

### Deploy the Under-Provisioned App

```bash
kubectl apply -f k8s/resources/step-06-tuning.yaml
```

This creates 2 replicas with deliberately low requests: **50m CPU / 64Mi memory** — way below what the app actually needs.

### Observe the Gap

```bash
kubectl top pods -n resources-demo --containers
```
```
NAMESPACE        POD                              CONTAINER       CPU(cores)   MEMORY(bytes)
resources-demo   demo-app-tune-7d8f9c6b4-abc12   k8s-demo-app    3m           48Mi
resources-demo   demo-app-tune-7d8f9c6b4-def34   k8s-demo-app    2m           46Mi
```

At idle: ~3m CPU, ~48Mi memory. But what happens under load?

### Generate Realistic Load

```bash
kubectl port-forward svc/demo-app-tune 8080:80 -n resources-demo &

# Moderate CPU stress
curl -X POST http://localhost:8080/api/stress/cpu \
  -H "Content-Type: application/json" \
  -d '{"minutes": 3, "targetPercentage": 50}'
```

Watch usage climb:
```bash
watch -n 2 kubectl top pods -n resources-demo -l app=demo-app-tune
```

### The Right-Sizing Framework

```
                                               ┌── Limit ──┐
                                               │            │
              ┌── Request ──┐                  │  P99 + 20% │
              │              │                 │  headroom   │
              │  P50 usage   │                 │            │
              │  (typical)   │                 │            │
──────────────┼──────────────┼─────────────────┼────────────┤
  0           │              │                 │            │
              └──────────────┘                 └────────────┘
```

| Setting | Formula | Why |
|---------|---------|-----|
| **Request** | P50 (typical usage) | Scheduler reserves this; represents steady-state needs |
| **Limit** | P99 + 20% headroom | Protects against worst-case spikes with some buffer |

### Practical Guidelines

| Workload Type | CPU Request | CPU Limit | Memory Request | Memory Limit |
|--------------|-------------|-----------|----------------|--------------|
| Web API (idle) | 50-100m | 500m-1 | 128-256Mi | 512Mi-1Gi |
| Web API (loaded) | 200-500m | 1-2 | 256-512Mi | 1-2Gi |
| Background worker | 100-200m | 500m | 128-256Mi | 512Mi |
| Database | 500m-2 | 2-4 | 1-4Gi | 4-8Gi |

### When You Don't Know: Use VPA

Instead of guessing, deploy [VPA in Off mode](../vpa/) to get data-driven recommendations:

```bash
# VPA watches your pods and tells you what they actually need
kubectl get vpa -n resources-demo -o yaml
```

### Check the App's Own Metrics

```bash
curl -s http://localhost:8080/metrics | grep -E "process_resident_memory_bytes|process_cpu_seconds_total"
```

These Prometheus metrics give you the app's view of its own resource consumption — useful for correlating with `kubectl top`.

### Clean Up Step 6

```bash
kubectl delete deployment demo-app-tune -n resources-demo
kubectl delete service demo-app-tune demo-app-tune-headless -n resources-demo
```

---

## 🧹 Step 7: Cleanup

Remove everything:

```bash
kubectl delete namespace resources-demo
```

Or use the cleanup manifest:

```bash
kubectl delete -f k8s/resources/step-07-cleanup.yaml
```

---

## Quick Reference Card

### Essential Commands

```bash
# Pod resources
kubectl top pods -n <ns>                              # Actual usage
kubectl top pods -n <ns> --sort-by=cpu                # Sort by CPU
kubectl top pods -n <ns> --sort-by=memory             # Sort by memory
kubectl top pods -n <ns> --containers                 # Per-container

# Node resources
kubectl top nodes                                      # Actual usage
kubectl get nodes -o custom-columns=\
  NAME:.metadata.name,\
  CPU-CAP:.status.capacity.cpu,\
  CPU-ALLOC:.status.allocatable.cpu,\
  MEM-CAP:.status.capacity.memory,\
  MEM-ALLOC:.status.allocatable.memory                # Capacity vs allocatable

kubectl describe nodes | grep -A 20 "Allocated resources:"  # What's committed

# Pod QoS at a glance
kubectl get pods -n <ns> -o custom-columns=\
  NAME:.metadata.name,\
  QOS:.status.qosClass,\
  CPU-REQ:.spec.containers[0].resources.requests.cpu,\
  CPU-LIM:.spec.containers[0].resources.limits.cpu,\
  MEM-REQ:.spec.containers[0].resources.requests.memory,\
  MEM-LIM:.spec.containers[0].resources.limits.memory

# Quotas and limits
kubectl describe resourcequota -n <ns>
kubectl describe limitrange -n <ns>

# Scheduling events
kubectl get events -n <ns> --field-selector reason=FailedScheduling
kubectl get events -n <ns> --field-selector reason=FailedCreate
kubectl get events -n <ns> --field-selector reason=OOMKilling

# Node pressure
kubectl get nodes -o custom-columns=\
  NAME:.metadata.name,\
  MEM-PRESSURE:.status.conditions[?(@.type==\"MemoryPressure\")].status,\
  DISK-PRESSURE:.status.conditions[?(@.type==\"DiskPressure\")].status
```

### Resource Decision Flowchart

```
Is your pod Pending?
├── Yes → Check FailedScheduling events
│         ├── "Insufficient cpu/memory" → Reduce requests or add nodes
│         ├── "node(s) had taints" → Add tolerations or use different nodes
│         └── "No preemption victims" → Nothing can be evicted to make room
│
Is your pod OOMKilled?
├── Yes → Container exceeded memory LIMIT
│         ├── Check exit code 137 (SIGKILL from OOM killer)
│         ├── Option: Increase memory limit
│         ├── Option: Fix memory leak
│         └── Option: Use VPA for auto-sizing
│
Is your pod Evicted?
├── Yes → NODE was under memory pressure
│         ├── BestEffort pods evicted first
│         ├── Then Burstable pods exceeding requests
│         └── Guaranteed pods evicted last
│         See: qos/ tutorial for eviction priority
│
Is your pod slow?
├── Yes → Check if CPU is being throttled
│         ├── kubectl top pods → compare actual vs limit
│         ├── Increase CPU limit
│         └── Or: remove CPU limit entirely (controversial!)
```

---

## Troubleshooting

### "My deployment has 3 replicas but only 2 pods are running"

1. Check for Pending pods: `kubectl get pods -n <ns>`
2. Check events: `kubectl get events -n <ns> --field-selector reason=FailedScheduling`
3. Check quota: `kubectl describe resourcequota -n <ns>`
4. Reduce requests or wait for Karpenter to provision a node

### "My pod keeps restarting with OOMKilled"

1. Check the limit: `kubectl describe pod <pod> -n <ns> | grep -A 5 "Limits"`
2. Check actual usage before crash: `kubectl top pods -n <ns>` (if you catch it in time)
3. Check last termination: `kubectl get pod <pod> -n <ns> -o jsonpath='{.status.containerStatuses[0].lastState}'`
4. Increase memory limit or fix the memory leak

### "kubectl top shows 0m CPU but my app is slow"

- `kubectl top` updates every ~30 seconds. Catch a spike by running it in a loop.
- CPU throttling doesn't show in `kubectl top` — it shows average, not peaks.
- Check the app's own metrics: `curl <pod-ip>:8080/metrics | grep process_cpu`

### "Quota rejected my deployment"

1. Check usage: `kubectl describe resourcequota -n <ns>`
2. Check what's consuming resources: `kubectl top pods -n <ns>`
3. Scale down other deployments or increase the quota

---

## Key Takeaways

1. **Requests are for the scheduler.** They determine WHERE your pod runs. Set them to typical (P50) usage.

2. **Limits are for the kernel.** They determine IF your pod lives. Set memory limits to P99 + headroom. CPU limits are optional (throttling vs killing).

3. **The scheduler doesn't see actual usage.** It only sees requests. A pod using 1m CPU but requesting 4 CPU blocks 4 CPU on the node.

4. **CPU overuse = throttled (slow). Memory overuse = killed (dead).** This asymmetry drives most resource decisions.

5. **OOMKill ≠ Eviction.** OOMKill is per-container (exceeded limit). Eviction is per-pod (node under pressure). Different causes, different fixes.

6. **Start with VPA in Off mode.** Don't guess — measure. Deploy, observe, then set based on data.

---

## What's Next?

| Tutorial | What You'll Learn |
|----------|-------------------|
| [QoS Classes & Eviction](../qos/) | How Kubernetes prioritizes pods during node pressure |
| [Vertical Pod Autoscaler](../vpa/) | Automatic resource right-sizing based on actual usage |
| [Bin Packing](../bin-packing/) | Optimize node utilization and reduce costs |
| [HPA](../hpa/) | Scale replicas based on CPU/memory metrics |

---

## Files in This Tutorial

| File | Purpose |
|------|---------|
| `step-01-observe.yaml` | Deploy app, learn to read resource info |
| `step-03-unschedulable.yaml` | Pod requesting too much — stays Pending |
| `step-04-memory-pressure.yaml` | Tight memory limit — trigger OOMKill |
| `step-05-quotas.yaml` | ResourceQuota + LimitRange governance |
| `step-06-tuning.yaml` | Under-provisioned app for right-sizing practice |
| `step-07-cleanup.yaml` | Delete the namespace |

> **Note:** Step 2 is a kubectl investigation exercise — no YAML needed.
