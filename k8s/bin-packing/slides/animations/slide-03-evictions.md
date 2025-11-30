# Animation – Slide 3 (Evictions)

**Goal:** Show memory pressure evicting BestEffort pods, and CPU pressure merely throttling pods that stay Running.

**First frame:**
```
┌─────────────────────────────────────────────────────────────────┐
│  MEMORY TRACK                          CPU TRACK                 │
│  Usage: [███▒▒.....]                   Usage: CPU 70%           │
│  Pods: [BE][BE][BU][BU][G]            Pods: [BU][BU][G]         │
│        (all Running)                         (all Running)       │
└─────────────────────────────────────────────────────────────────┘
```

**Middle frame (pressure building):**
```
┌─────────────────────────────────────────────────────────────────┐
│  MEMORY TRACK                          CPU TRACK                 │
│  Usage: [█████▒▒...]                   Usage: CPU 85%           │
│  ⚠️ MemoryPressure: True               ⚠️ Throttling active     │
│  Pods: [BE][BE][BU][BU][G]            Pods: [BU][BU][G]         │
│        (kubelet selecting victims)           (slower responses)  │
└─────────────────────────────────────────────────────────────────┘
```

**Last frame (pressure resolved):**
```
┌─────────────────────────────────────────────────────────────────┐
│  MEMORY TRACK                          CPU TRACK                 │
│  Usage: [██████▒▒..]                   Usage: CPU 95% (limits)  │
│  Pods: [  ][  ][BU][BU][G]            Pods: [BU⌛][BU⌛][G✓]     │
│        ↓↓ evicted ↓↓                          (still Running)    │
│  Pending queue: BE → Pending           Caption: "Throttled,     │
│                                                  not evicted"    │
├─────────────────────────────────────────────────────────────────┤
│  EVICTION ORDER:                                                 │
│  1. BestEffort (first out)                                      │
│  2. Burstable over requests                                     │
│  3. Burstable within requests                                   │
│  4. Guaranteed (last resort)                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Animation notes:**
- Memory lane: BE blocks fade/slide to a "Pending" lane; show "Evicted" label
- CPU lane: Add hourglass icon (⌛) but keep pods visible and Running
- Blink a "Pressure" indicator when thresholds are crossed
- Show the eviction priority order at the end

**CLI commands to run alongside:**
```bash
# Watch eviction events in real-time
kubectl events -n bin-packing-demo --watch --types=Warning

# Show node conditions
kubectl describe nodes | grep -A 5 "Conditions:"
```

**References:**
- Node-pressure Eviction: https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/
