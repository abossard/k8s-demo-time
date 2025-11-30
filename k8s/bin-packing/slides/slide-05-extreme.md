# Slide 5 – Extreme Bin Packing Storyboard

**Core message:** Cost win vs. fragility trade-off. Frontend Guaranteed; backends Burstable; BestEffort workers fill gaps until growth pushes them out.

**Static visual prompt:**
```
Before load: [G][G] [BU][BU][BU] [BE][BE][BE][BE][BE] spread across 2 nodes
After load:  [G][G][G][G] [BU][BU][BU]  (BE pods evicted/pending)
```

**Narration beats:**
- “All services running, ~20 pods packed tightly.”【F:k8s/bin-packing/README.md†L300-L310】
- “Traffic spike → you bump frontend replicas to 4 (what an autoscaler would do).”【F:k8s/bin-packing/README.md†L165-L191】【F:k8s/bin-packing/README.md†L300-L323】
- “Node pressure → BestEffort workers/cache/analytics evicted first; core stays healthy.”【F:k8s/bin-packing/README.md†L415-L442】
- “CPU pressure throttles but keeps pods running; memory pressure triggers eviction ordering.”【F:k8s/bin-packing/README.md†L236-L264】
- “Takeaway: choose which workloads are expendable and monitor eviction rates.”【F:k8s/bin-packing/README.md†L480-L506】

**Animation cue:** see `../animations/slide-05-extreme.md`.

**References:**
- Cost vs. Reliability Trade-offs: https://sre.google/sre-book/cost-of-reliability/
- Kubernetes Monitoring Suggestions: https://kubernetes.io/docs/tasks/debug/debug-cluster/monitor-node-health/
