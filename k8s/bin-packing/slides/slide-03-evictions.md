# Slide 3 – Pressure, Evictions, and Rescheduling

**Core message:** Under memory pressure, kubelet evicts BestEffort → Burstable → (rare) Guaranteed. Under CPU pressure, pods throttle instead of evicting.

**Static visual prompt:**
```
Memory pressure → Evict
Node: [███▒▒.....] → [██████▒▒..]
Pods: [BE][BE][BU][BU][G] → [  ][  ][BU][BU][G]

CPU pressure → Throttle
Node: CPU 90% (limits hit)
Pods: [BU (⌛)][BU (⌛)][G (ok)] stay Running
```

**Narration beats:**
- Describe pressure signals, and contrast memory eviction vs. CPU throttling.【F:k8s/bin-packing/README.md†L236-L264】
- Step 6 memory stress triggers BestEffort evictions first.【F:k8s/bin-packing/README.md†L234-L268】
- CPU stress keeps pods Running but throttled; watch latency instead of evictions.【F:k8s/bin-packing/README.md†L236-L264】
- Step 7 manual scale causes low-priority pods to evict to make room for growth.【F:k8s/bin-packing/README.md†L271-L284】【F:k8s/bin-packing/README.md†L407-L448】

**Animation cue:** see `../animations/slide-03-evictions.md`.

**References:**
- Eviction Policy: https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/
- Pod Priority & Preemption: https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/
