# Bin Packing Demo Slides

Each slide and its animation prompt now lives in its own file for easy redrawing. Use `slides/ANIMATION-TOOLS.md` for CLI-friendly ASCII animation options.

## Slide Index

- Slide 1 – Bin Packing Basics: `slides/slide-01-basics.md` (animation: `slides/animations/slide-01-basics.md`)
- Slide 2 – Requests vs Limits → QoS: `slides/slide-02-qos.md` (animation: `slides/animations/slide-02-qos.md`)
- Slide 3 – Pressure, Evictions, and Rescheduling: `slides/slide-03-evictions.md` (animation: `slides/animations/slide-03-evictions.md`)
- Slide 4 – Autoscaling + Limits = Dynamic Packing: `slides/slide-04-autoscaling.md` (animation: `slides/animations/slide-04-autoscaling.md`)
- Slide 5 – Extreme Bin Packing Storyboard: `slides/slide-05-extreme.md` (animation: `slides/animations/slide-05-extreme.md`)

## Live Monitoring Dashboard

During the demo, keep CLI commands running to expose eviction decisions in real-time. See the [Live Monitoring Dashboard](README.md#-live-monitoring-dashboard-cli-commands-for-continuous-investigation) section in the main README for:

- **Terminal 1:** Real-time events stream (eviction focus)
- **Terminal 2:** Pod status with QoS visibility
- **Terminal 3:** Node pressure conditions
- **Terminal 4:** Eviction decision summary

## Animation Tips

If you want a live-playback version of the ASCII animations, record the transitions with asciinema or terminalizer, then export to GIF/SVG for the deck.

## Key Concepts Across Slides

| Slide | Key Concept | What to Monitor |
|-------|-------------|-----------------|
| 1 | Requests drive placement | `kubectl top nodes` |
| 2 | QoS classes signal priority | `kubectl get pods -o custom-columns=...,QOS:...` |
| 3 | Memory evicts, CPU throttles | `kubectl events --watch` |
| 4 | Manual scale shows packing | `kubectl scale deployment/...` |
| 5 | Extreme: core survives, BE sacrificed | Eviction count + priority order |
