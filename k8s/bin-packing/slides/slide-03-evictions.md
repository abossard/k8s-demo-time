# Slide 3 – Pressure, Evictions, and Rescheduling

**Core message:** Under memory pressure, kubelet evicts BestEffort → Burstable → (rare) Guaranteed. Under CPU pressure, pods throttle instead of evicting.

**Why memory and CPU behave differently:**
- **Memory is incompressible**: Once allocated, memory cannot be "shared" or reclaimed without killing the process. If a node runs out of memory, something must die.
- **CPU is compressible**: CPU cycles can be throttled—pods simply run slower but stay alive. The kernel can share CPU time across processes.

**Static visual prompt:**
```
┌─────────────────────────────────────────────────────────────────┐
│  MEMORY PRESSURE → EVICTION                                     │
│  Node: [███▒▒.....] → [██████▒▒..]                             │
│  Pods: [BE][BE][BU][BU][G] → [  ][  ][BU][BU][G]               │
│        ↓↓ evicted ↓↓          (still running)                   │
│  Result: BestEffort pods → Pending/Evicted queue                │
├─────────────────────────────────────────────────────────────────┤
│  CPU PRESSURE → THROTTLING                                      │
│  Node: CPU 90% (limits hit)                                     │
│  Pods: [BU (⌛)][BU (⌛)][G (ok)] stay Running                  │
│  Result: Slower response, no evictions                          │
└─────────────────────────────────────────────────────────────────┘
```

**Narration beats:**
1. **Memory vs. CPU behavior:** "Memory pressure triggers eviction; CPU pressure only throttles. Memory is incompressible—once allocated, it can't be shared. CPU is compressible—we can just slow things down."
2. **Eviction order:** "Kubelet evicts BestEffort first, then Burstable exceeding requests, then Burstable within requests, and Guaranteed only as a last resort."
3. **Step 6 demo:** "Memory stress on mixed QoS pods shows BestEffort evictions first."【F:k8s/bin-packing/README.md†L234-L268】
4. **Step 7 demo:** "Manual scaling creates pressure; low-priority pods are evicted to make room."【F:k8s/bin-packing/README.md†L271-L284】【F:k8s/bin-packing/README.md†L407-L448】
5. **Live monitoring:** "Use the CLI monitoring commands to see eviction decisions in real-time."

**Live monitoring commands to show during this slide:**
```bash
# Watch eviction events in real-time
kubectl events -n bin-packing-demo --watch --types=Warning

# Show pods with QoS class and priority
kubectl get pods -n bin-packing-demo \
  -o custom-columns=NAME:.metadata.name,QOS:.status.qosClass,STATUS:.status.phase

# Check node pressure conditions
kubectl describe nodes | grep -A 5 "Conditions:"
```

**Animation cue:** see `../animations/slide-03-evictions.md`.

**See also:** [Live Monitoring Dashboard](../README.md#-live-monitoring-dashboard-cli-commands-for-continuous-investigation) for full CLI setup.

**References:**
- Eviction Policy: https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/
- Pod Priority & Preemption: https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/
- A Guide to Kubernetes Pod Eviction: https://opensource.com/article/21/12/kubernetes-pod-eviction
- Every Pod Eviction Explained: https://ahmet.im/blog/kubernetes-evictions/
