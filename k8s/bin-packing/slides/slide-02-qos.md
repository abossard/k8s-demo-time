# Slide 2 – Requests vs Limits → QoS Classes

**Core message:** Requests drive placement; limits gate burst. QoS signals who stays when pressure hits.

**Static visual prompt:**
```
Requests: 200m/300Mi     Limits: 400m/600Mi
QoS: Guaranteed if req==limit; Burstable if req<limit; BestEffort if none.
```

**Narration beats:**
- Show QoS mapping and why Guaranteed costs more headroom.
- Step 2 introduces QoS to pack more efficiently.【F:k8s/bin-packing/README.md†L107-L129】
- Step 3 lowers requests vs limits to allow controlled bursting.【F:k8s/bin-packing/README.md†L132-L162】

**Animation cue:** see `../animations/slide-02-qos.md`.

**References:**
- QoS Classes: https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/
- Requests & Limits Explained: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
