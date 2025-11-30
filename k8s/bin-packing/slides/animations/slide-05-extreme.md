# Animation – Slide 5 (Extreme Bin Packing)

**Goal:** Show BestEffort fillers being evicted as frontend scales up, leaving Guaranteed/Burstable.

**First frame:**
```
Node 1: [G][BU][BE][BE]
Node 2: [G][BU][BE][BE][BE]
Queue: (empty)
```

**Last frame:**
```
Node 1: [G][G][BU]
Node 2: [G][BU]
Queue: BE → Pending/Evicted
```

**Note:** Animate new frontend (G) boxes spawning with “Scaled +2”, followed by BE boxes sliding to a Pending/Evicted lane.
