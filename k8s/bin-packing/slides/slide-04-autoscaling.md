# Slide 4 – Manual Scale + Limits = Dynamic Packing

**Core message:** Show bin packing instantly by bumping replicas with `kubectl scale`; VPA still retunes requests over time.

**Static visual prompt:**
```
Load ↑ → `kubectl scale frontend --replicas=4`
VPA: adjusts backend reqs from 500m→300m over time
```

**Narration beats:**
- Step 4 shows manual scaling for quick, visible packing changes.【F:k8s/bin-packing/README.md†L165-L191】
- Step 5 lets VPA right-size requests based on real usage.【F:k8s/bin-packing/README.md†L193-L222】
- Combined effect: more pods fit per node while staying right-sized.

**Animation cue:** see `../animations/slide-04-autoscaling.md`.

**References:**
- Vertical Pod Autoscaler: https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler#readme
