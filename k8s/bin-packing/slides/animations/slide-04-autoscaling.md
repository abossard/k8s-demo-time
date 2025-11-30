# Animation – Slide 4 (Manual Scale + Limits)

**Goal:** Show manual `kubectl scale` adding replicas while VPA slims requests to fit more pods per node.

**First frame:**
```
Node: [frontend][frontend]   (wide request boxes)
Backend: request = 500m each
```

**Last frame:**
```
Node: [frontend][frontend][frontend][frontend] (narrower request boxes)
Backend: request retuned to 300m each
```

**Note:** Animate a `kubectl scale` arrow duplicating frontend boxes, then VPA arrows shrinking backend box widths.
