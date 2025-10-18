# Visual Guide: VPA, HPA, and QoS Interaction

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Kubernetes Cluster                                  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        Control Plane                                │ │
│  │                                                                      │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │ │
│  │  │     HPA      │  │     VPA      │  │   Scheduler  │             │ │
│  │  │   Controller │  │  Controller  │  │              │             │ │
│  │  │              │  │              │  │  (QoS-aware) │             │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │ │
│  │         │                 │                 │                       │ │
│  │         │ Scales          │ Adjusts         │ Schedules &          │ │
│  │         │ Replicas        │ Requests        │ Evicts               │ │
│  │         │                 │                 │                       │ │
│  └─────────┼─────────────────┼─────────────────┼───────────────────────┘ │
│            │                 │                 │                         │
│            ▼                 ▼                 ▼                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                          Worker Nodes                                ││
│  │                                                                       ││
│  │  ┌───────────────────────────────────────────────────────────────┐  ││
│  │  │  Pod: Guaranteed QoS + HPA (Critical Frontend)                │  ││
│  │  │  ┌─────────────────────────────────────────┐                  │  ││
│  │  │  │ Requests: 500m CPU, 512Mi Memory        │                  │  ││
│  │  │  │ Limits:   500m CPU, 512Mi Memory        │ ← Equal = Guaranteed││
│  │  │  │ Priority: High (1000000)                │                  │  ││
│  │  │  │ Replicas: 2-10 (HPA managed)            │ ← HPA scales    │  ││
│  │  │  └─────────────────────────────────────────┘                  │  ││
│  │  │  Eviction Priority: LAST                                       │  ││
│  │  └───────────────────────────────────────────────────────────────┘  ││
│  │                                                                       ││
│  │  ┌───────────────────────────────────────────────────────────────┐  ││
│  │  │  Pod: Burstable QoS + VPA (Standard Backend)                  │  ││
│  │  │  ┌─────────────────────────────────────────┐                  │  ││
│  │  │  │ Requests: 200m CPU, 256Mi Memory        │                  │  ││
│  │  │  │ Limits:   1 CPU, 1Gi Memory             │ ← Different = Burstable││
│  │  │  │ Priority: Medium (500000)               │                  │  ││
│  │  │  │ Replicas: 3 (fixed)                     │                  │  ││
│  │  │  │ Resources adjusted by VPA               │ ← VPA adjusts   │  ││
│  │  │  └─────────────────────────────────────────┘                  │  ││
│  │  │  Eviction Priority: SECOND                                     │  ││
│  │  └───────────────────────────────────────────────────────────────┘  ││
│  │                                                                       ││
│  │  ┌───────────────────────────────────────────────────────────────┐  ││
│  │  │  Pod: BestEffort QoS (Batch Worker)                           │  ││
│  │  │  ┌─────────────────────────────────────────┐                  │  ││
│  │  │  │ Requests: None                           │                  │  ││
│  │  │  │ Limits:   None                           │ ← None = BestEffort││
│  │  │  │ Priority: Low (100000)                   │                  │  ││
│  │  │  │ Replicas: 2 (fixed)                      │                  │  ││
│  │  │  │ No autoscaling                           │                  │  ││
│  │  │  └─────────────────────────────────────────┘                  │  ││
│  │  │  Eviction Priority: FIRST                                      │  ││
│  │  └───────────────────────────────────────────────────────────────┘  ││
│  │                                                                       ││
│  └───────────────────────────────────────────────────────────────────────┘│
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## Decision Tree: Which Autoscaling Strategy?

```
                          Start
                            │
                            ▼
                   ┌────────────────┐
                   │  What scales?  │
                   └────────┬───────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
       ┌──────────┐              ┌──────────────┐
       │ Replicas │              │  Resources   │
       │  (HPA)   │              │    (VPA)     │
       └────┬─────┘              └──────┬───────┘
            │                           │
            ▼                           ▼
    ┌──────────────┐           ┌─────────────────┐
    │ What metric? │           │ Which resource? │
    └──────┬───────┘           └────────┬────────┘
           │                            │
    ┌──────┴──────┐           ┌─────────┴─────────┐
    ▼             ▼           ▼                   ▼
┌──────┐     ┌────────┐  ┌──────┐           ┌────────┐
│ CPU  │     │ Memory │  │ CPU  │           │ Memory │
│      │     │   or   │  │      │           │        │
│      │     │ Custom │  │      │           │        │
└──┬───┘     └───┬────┘  └──┬───┘           └───┬────┘
   │             │          │                   │
   ▼             ▼          ▼                   ▼
Use HPA      Use HPA    Use VPA            Use VPA
with CPU     with       (less common)      (recommended)
target       target
```

## QoS Class Selection Guide

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Is this a critical service?                       │
└─────────────────┬──────────────────────────────────┬────────────────┘
                  │ YES                              │ NO
                  ▼                                  ▼
    ┌──────────────────────────┐        ┌──────────────────────────┐
    │   Use Guaranteed QoS     │        │  Can it handle variable  │
    │                          │        │      resources?          │
    │ requests == limits       │        └────────┬─────────────────┘
    │ High Priority            │                 │
    │ Protected from eviction  │     ┌───────────┴────────────┐
    └──────────────────────────┘     │ YES                    │ NO
                                     ▼                        ▼
                      ┌───────────────────────┐   ┌─────────────────────┐
                      │  Use Burstable QoS    │   │ Use BestEffort QoS  │
                      │                       │   │                     │
                      │ requests < limits     │   │ No requests/limits  │
                      │ Medium Priority       │   │ Low Priority        │
                      │ Flexible resources    │   │ First to evict      │
                      └───────────────────────┘   └─────────────────────┘

Examples:                Examples:                  Examples:
• Databases              • Web applications          • Batch jobs
• Payment systems        • API services              • Dev environments
• Auth services          • Caching layers            • Background tasks
```

## Eviction Sequence Under Memory Pressure

```
Node Memory: [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓] 100% Used
                                   ↓
                          Memory Pressure Detected
                                   ↓
              ┌────────────────────┴────────────────────┐
              │          Kubelet Eviction Order          │
              └────────────────────┬────────────────────┘
                                   ▼
         ┌───────────────────────────────────────────────────┐
         │                                                   │
    Step 1: Evict BestEffort Pods                          │
         │  ┌─────────────────────────────────┐            │
         │  │ • batch-worker                  │            │
         │  │ • dev-environment               │            │
         │  │ Priority: Lowest                │            │
         │  └─────────────────────────────────┘            │
         │                    │                             │
         │                    ▼                             │
         │        Still under pressure?                     │
         │                    │                             │
         │                 ┌──┴──┐                          │
         │                 │ YES │                          │
         │                 └──┬──┘                          │
         │                    ▼                             │
    Step 2: Evict Burstable Pods (exceeding requests)     │
         │  ┌─────────────────────────────────┐            │
         │  │ • standard-backend              │            │
         │  │ • api-service                   │            │
         │  │ Priority: Medium                │            │
         │  │ Evict pods using > requests     │            │
         │  └─────────────────────────────────┘            │
         │                    │                             │
         │                    ▼                             │
         │        Still under pressure?                     │
         │                    │                             │
         │                 ┌──┴──┐                          │
         │                 │ YES │                          │
         │                 └──┬──┘                          │
         │                    ▼                             │
    Step 3: Evict Burstable Pods (within requests)        │
         │  ┌─────────────────────────────────┐            │
         │  │ Even if using < requests        │            │
         │  │ Sorted by usage                 │            │
         │  └─────────────────────────────────┘            │
         │                    │                             │
         │                    ▼                             │
         │        Still under pressure?                     │
         │                    │                             │
         │                 ┌──┴──┐                          │
         │                 │ YES │                          │
         │                 └──┬──┘                          │
         │                    ▼                             │
    Step 4: Evict Guaranteed Pods (LAST RESORT)           │
         │  ┌─────────────────────────────────┐            │
         │  │ • critical-frontend             │            │
         │  │ • database                      │            │
         │  │ • payment-service               │            │
         │  │ Priority: Highest               │            │
         │  │ Evicted only in extreme cases   │            │
         │  └─────────────────────────────────┘            │
         │                                                   │
         └───────────────────────────────────────────────────┘
```

## Practical Examples

### Example 1: E-commerce Application

```
┌─────────────────────────────────────────────────────────────┐
│                  E-commerce Platform                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Frontend (API Gateway)                                      │
│  ├─ QoS: Guaranteed (critical user-facing)                  │
│  ├─ HPA: CPU-based (handles traffic spikes)                 │
│  └─ Replicas: 3-20                                           │
│                                                              │
│  Product Catalog Service                                     │
│  ├─ QoS: Burstable (can burst during peak times)            │
│  ├─ VPA: Memory-based (cache sizes vary)                    │
│  └─ Replicas: 5 (fixed)                                      │
│                                                              │
│  Payment Service                                             │
│  ├─ QoS: Guaranteed (zero tolerance for failure)            │
│  ├─ HPA: CPU-based (scales with transactions)               │
│  ├─ Priority: Highest                                        │
│  └─ Replicas: 2-10                                           │
│                                                              │
│  Image Optimization Worker                                   │
│  ├─ QoS: BestEffort (batch processing, can restart)         │
│  ├─ No autoscaling                                           │
│  └─ Replicas: 3 (fixed, runs when resources available)      │
│                                                              │
│  Analytics Pipeline                                          │
│  ├─ QoS: Burstable (needs resources but not critical)       │
│  ├─ VPA: Memory-based (dataset size varies)                 │
│  └─ Replicas: 2 (fixed)                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Example 2: Resource Requests Evolution with VPA

```
Time: Day 0 (Initial Deployment)
┌──────────────────────────────────┐
│ Pod: backend-service             │
│ Requests: 100m CPU, 128Mi Memory │  ← Underprovisioned
│ Limits:   1 CPU, 1Gi Memory      │
│ Actual Usage: 250m CPU, 400Mi    │  ← Using more than requested
└──────────────────────────────────┘

          ↓ VPA observes usage patterns

Time: Day 2 (VPA Recommendation)
┌──────────────────────────────────┐
│ VPA Status:                      │
│ Recommended: 300m CPU, 512Mi     │  ← Better recommendation
│ Update Mode: Off                 │  ← Just recommending
└──────────────────────────────────┘

          ↓ Enable Auto mode

Time: Day 3 (VPA Auto Update)
┌──────────────────────────────────┐
│ Pod: backend-service (recreated) │
│ Requests: 300m CPU, 512Mi Memory │  ← VPA applied recommendations
│ Limits:   1 CPU, 1Gi Memory      │
│ Actual Usage: 280m CPU, 480Mi    │  ← Now properly provisioned
└──────────────────────────────────┘

          ↓ Usage increases

Time: Week 2 (Organic Growth)
┌──────────────────────────────────┐
│ Pod: backend-service (recreated) │
│ Requests: 400m CPU, 768Mi Memory │  ← VPA adjusted again
│ Limits:   1 CPU, 1Gi Memory      │
│ Actual Usage: 380m CPU, 720Mi    │  ← Still well-provisioned
└──────────────────────────────────┘
```

### Example 3: HPA Scaling Behavior

```
Load:    [░░░░░░░░░░] 10%     No scaling needed
Replicas: 2

         ↓ Traffic increases

Load:    [▓▓▓▓▓▓░░░░] 65%     Above target (60%)
Replicas: 2 → 4                 Scale up (doubled)

         ↓ More traffic

Load:    [▓▓▓▓▓▓▓░░░] 72%     Still above target
Replicas: 4 → 8                 Scale up again

         ↓ Peak traffic

Load:    [▓▓▓▓▓▓▓▓▓▓] 90%     Way above target
Replicas: 8 → 10                Hit max replicas

         ↓ Traffic decreases

Load:    [▓▓▓▓░░░░░░] 45%     Below target
Replicas: 10 → 10               Stabilization window (5 min)

         ↓ 5 minutes pass

Load:    [▓▓▓░░░░░░░] 40%     Still below target
Replicas: 10 → 5                Scale down (50%)

         ↓ Return to normal

Load:    [▓▓░░░░░░░░] 25%     Well below target
Replicas: 5 → 3                 Scale down again

         ↓ Idle period

Load:    [░░░░░░░░░░] 5%      Very low
Replicas: 3 → 2                 Hit min replicas
```

## Summary Table

| Feature | HPA | VPA | QoS Classes |
|---------|-----|-----|-------------|
| **What it does** | Scales pod replicas | Adjusts resource requests | Determines eviction priority |
| **When to use** | CPU/memory bound workloads | Right-sizing resources | All workloads |
| **Pod restart** | No | Yes (Auto/Recreate mode) | No (just classification) |
| **Best for** | Stateless apps | Any workload | Critical vs non-critical separation |
| **Conflicts with** | VPA on same resource | HPA on same resource | None |
| **Response time** | Fast (seconds-minutes) | Slow (hours-days) | Immediate (scheduling/eviction) |

## Getting Started

Choose your learning path:

1. **Start with QoS** → Understand eviction priorities first
2. **Add HPA** → Learn horizontal scaling for CPU-bound apps
3. **Explore VPA** → Optimize resource requests over time
4. **Combine** → Use together for comprehensive autoscaling

See the respective README files in each directory for detailed tutorials!
