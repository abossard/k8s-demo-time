# Slide 1 – Bin Packing Basics

**Core message:** The scheduler packs pods by *requests*, not limits, so honest requests make efficient packing possible.

**Static visual prompt:**
```
[NODE 1 4 CPU/8GB]
| 2C/3G (frontend) | 1C/1G (backend) | 0.2C/0.1G (worker) |

[NODE 2 4 CPU/8GB]
| 1C/1G (backend) | 0.2C/0.1G (worker) | 0.2C/0.1G (worker) |
```

**Narration beats:**
- Bin packing reduces nodes and cost but shrinks spike headroom.
- Requests-only placement: realistic requests are key to utilization.【F:k8s/bin-packing/README.md†L5-L21】
- Trade-off framing sets context for the later steps.【F:k8s/bin-packing/README.md†L17-L21】

**Animation cue:** see `../animations/slide-01-basics.md`.

**References:**
- Kubernetes Scheduler Design: https://kubernetes.io/docs/concepts/scheduling-eviction/
- Resource Management: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
