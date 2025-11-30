# Slide 5 – Extreme Bin Packing Storyboard

**Core message:** Cost win vs. fragility trade-off. Frontend Guaranteed; backends Burstable; BestEffort workers fill gaps until growth pushes them out.

**Static visual prompt:**
```
┌─────────────────────────────────────────────────────────────────┐
│  BEFORE LOAD (all pods running, tightly packed)                 │
│  Node 1: [G][G] [BU][BU][BU] [BE][BE][BE]                      │
│  Node 2: [G]    [BU]         [BE][BE][BE][BE][BE]              │
│                                                                  │
│  Total: ~20 pods, 70% utilization, all services healthy        │
├─────────────────────────────────────────────────────────────────┤
│  AFTER LOAD (manual scale → kubectl scale --replicas=4)         │
│  Node 1: [G][G][G][G] [BU][BU][BU]                             │
│  Node 2: [G]          [BU]                                      │
│                                                                  │
│  Pending queue: [BE][BE][BE][BE] ← evicted to make room        │
│  Result: Frontend scaled, BestEffort sacrificed                 │
└─────────────────────────────────────────────────────────────────┘
```

**Narration beats:**
1. **Setup:** "All services running, ~20 pods packed tightly across 2 nodes."【F:k8s/bin-packing/README.md†L300-L310】
2. **Traffic spike:** "Traffic spike → you bump frontend replicas to 4 with kubectl scale (what an autoscaler would do)."【F:k8s/bin-packing/README.md†L165-L191】【F:k8s/bin-packing/README.md†L300-L323】
3. **Eviction behavior:** "Node pressure → BestEffort workers/cache/analytics evicted first; core stays healthy."【F:k8s/bin-packing/README.md†L415-L442】
4. **Key insight:** "CPU pressure throttles but keeps pods running; memory pressure triggers eviction ordering."【F:k8s/bin-packing/README.md†L236-L264】
5. **Takeaway:** "Choose which workloads are expendable and monitor eviction rates."【F:k8s/bin-packing/README.md†L480-L506】

**Live monitoring commands to show during this slide:**
```bash
# Terminal 1: Watch eviction events
kubectl events -n bin-packing-demo --watch

# Terminal 2: Watch pod status with QoS
watch -n 2 'kubectl get pods -n bin-packing-demo \
  -o custom-columns=NAME:.metadata.name,QOS:.status.qosClass,STATUS:.status.phase'

# Terminal 3: Check eviction count
watch -n 3 'echo "Evicted pods:" && \
  kubectl get pods -n bin-packing-demo --field-selector=status.phase=Failed --no-headers | wc -l'

# Terminal 4: Node pressure
kubectl describe nodes | grep -A 5 "Conditions:"
```

**Demo commands:**
```bash
# Apply extreme packing config
kubectl apply -f k8s/bin-packing/step-07-extreme-packing.yaml

# Simulate scale-up (manual, to see immediate effect)
kubectl scale deployment/frontend -n bin-packing-demo --replicas=4
kubectl scale deployment/backend -n bin-packing-demo --replicas=4

# Watch evictions happen
kubectl get events -n bin-packing-demo --field-selector reason=Evicted -w
```

**Animation cue:** see `../animations/slide-05-extreme.md`.

**See also:** [Live Monitoring Dashboard](../README.md#-live-monitoring-dashboard-cli-commands-for-continuous-investigation) for full CLI setup.

**References:**
- Cost vs. Reliability Trade-offs: https://sre.google/sre-book/cost-of-reliability/
- Kubernetes Monitoring Suggestions: https://kubernetes.io/docs/tasks/debug/debug-cluster/monitor-node-health/
- Node-pressure Eviction: https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/
- A Guide to Kubernetes Pod Eviction: https://opensource.com/article/21/12/kubernetes-pod-eviction
