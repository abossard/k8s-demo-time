# Animation – Slide 2 (Requests vs Limits → QoS)

**Goal:** Fade from neutral boxes to QoS shading to show priority cues.

**First frame:**
```
[Pod A 200m/300Mi] [Pod B 200m/300Mi] [Pod C 200m/300Mi]
(all same outline)
```

**Last frame:**
```
[Pod A 200m/300Mi] = solid fill (Guaranteed)
[Pod B 200m/300Mi -> 400m/600Mi limit] = striped (Burstable)
[Pod C no req/limit] = hollow outline (BestEffort)
```

**Note:** Pulse arrows from “Requests” to “Placement” and from “Limits” to “Throttle” to reinforce roles.
