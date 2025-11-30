# Animation – Slide 3 (Evictions)

**Goal:** Show memory pressure evicting BestEffort pods, and CPU pressure merely throttling pods that stay Running.

**First frame:**
```
Memory track:
Usage: [███▒▒.....]
Pods: [BE][BE][BU][BU][G]

CPU track:
Usage: CPU 70%
Pods: [BU][BU][G]
```

**Last frame:**
```
Memory track:
Usage: [██████▒▒..]
Pods: [  ][  ][BU][BU][G]
Pending queue: BE → Pending

CPU track:
Usage: CPU 95% (limits hit)
Pods: [BU (⌛)][BU (⌛)][G (ok)]
Caption: "Throttled, not evicted"
```

**Note:** Blink a “Pressure” indicator: memory lane fades BE blocks into a Pending lane; CPU lane adds an hourglass icon but keeps pods visible.
