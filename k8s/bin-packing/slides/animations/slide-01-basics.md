# Animation – Slide 1 (Bin Packing Basics)

**Goal:** Show how spreading pods with honest requests consolidates onto fewer nodes.

**First frame:**
```
Node A: [ ] [ ] [ ]   (scattered small gaps)
Node B: [ ]   [ ] [ ]
Node C: [ ] [ ]   [ ]
```

**Last frame:**
```
Node A: [frontend][backend][worker]
Node B: [backend][worker][worker]
Node C: (empty/gray to indicate scaled-in)
```

**Note:** Animate gaps shrinking and one node going dark to emphasize cost savings.
