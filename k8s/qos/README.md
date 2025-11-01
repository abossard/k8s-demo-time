# Quality of Service (QoS) and Eviction Priority Tutorial

## Overview

This tutorial demonstrates Kubernetes Quality of Service (QoS) classes and how they determine pod eviction priority when nodes experience resource pressure. Understanding QoS is critical for designing resilient applications that handle resource constraints gracefully.

## Prerequisites

- Kubernetes cluster with sufficient resources
- `kubectl` access to the cluster
- The k8s-demo-app image available in your registry
- Ability to create resource pressure (or use the stress endpoints)

## QoS Classes

Kubernetes assigns one of three QoS classes to every pod based on resource requests and limits:

### 1. **Guaranteed** (Highest Priority)
- **Criteria:** All containers have CPU and memory requests **equal** to limits
- **Eviction:** Evicted **last** under memory pressure
- **Use Case:** Critical services, databases, stateful applications

### 2. **Burstable** (Medium Priority)
- **Criteria:** At least one container has CPU or memory request, but requests ≠ limits
- **Eviction:** Evicted **second**, after BestEffort but before Guaranteed
- **Use Case:** Standard web applications, API services with variable load

### 3. **BestEffort** (Lowest Priority)
- **Criteria:** No CPU or memory requests or limits specified
- **Eviction:** Evicted **first** under memory pressure
- **Use Case:** Batch jobs, non-critical background tasks, development workloads

## Eviction Priority

When a node runs out of memory, the kubelet evicts pods in this order:

1. **BestEffort pods** (lowest priority)
2. **Burstable pods** exceeding requests (by usage percentage)
3. **Burstable pods** within requests
4. **Guaranteed pods** (highest priority, evicted last)

Within the same QoS class, pods using more memory relative to their requests are evicted first.

## Theory: How Kubernetes Eviction Works

### When and Why Kubernetes Evicts Pods

Kubernetes evicts pods when nodes experience resource pressure to protect node stability and prevent system-wide failures.

```mermaid
flowchart TD
    A[Node Operating Normally] --> B{Kubelet Monitors<br/>Resource Usage}
    B --> C{Resource Threshold<br/>Crossed?}
    C -->|No| B
    C -->|Yes: Memory Pressure| D[Memory Available < 100Mi<br/>or < 10% of capacity]
    C -->|Yes: Disk Pressure| E[Disk Available < 10%<br/>or Inodes < 5%]
    C -->|Yes: PID Pressure| F[PIDs Available < Threshold]
    
    D --> G[Node Condition:<br/>MemoryPressure=True]
    E --> H[Node Condition:<br/>DiskPressure=True]
    F --> I[Node Condition:<br/>PIDPressure=True]
    
    G --> J{Hard or Soft<br/>Eviction?}
    H --> J
    I --> J
    
    J -->|Hard Threshold<br/>Immediate| K[Kubelet Immediately<br/>Selects Pods to Evict]
    J -->|Soft Threshold<br/>Grace Period| L[Wait for Grace Period<br/>default 90s]
    L --> M{Still Over<br/>Threshold?}
    M -->|Yes| K
    M -->|No| B
    
    K --> N[Select Pods by Priority:<br/>1. BestEffort<br/>2. Burstable exceeding requests<br/>3. Burstable within requests<br/>4. Guaranteed]
    N --> O[Terminate Selected Pod]
    O --> P[Pod Status: Failed<br/>Reason: Evicted]
    P --> Q{Deployment/RS<br/>Manages Pod?}
    Q -->|Yes| R[Controller Creates<br/>New Pod]
    Q -->|No| S[Pod Remains Evicted]
    R --> T{Enough Resources<br/>on Any Node?}
    T -->|Yes| U[Pod Scheduled on<br/>Different Node]
    T -->|No| V[Pod Pending<br/>Waiting for Resources]
    V --> W{Cluster Autoscaler<br/>Enabled?}
    W -->|Yes| X[Add New Node]
    W -->|No| Y[Pod Stays Pending]
    X --> U
```

**Key Eviction Triggers:**
- **Memory Pressure:** `memory.available < 100Mi` (hard) or `memory.available < 10%` (soft)
- **Disk Pressure:** `nodefs.available < 10%` or `imagefs.available < 15%`
- **PID Pressure:** Available PIDs below threshold
- **Inode Pressure:** `nodefs.inodesFree < 5%`

### OOMKill vs Eviction: Understanding the Difference

Both OOMKill and eviction terminate pods, but they occur at different stages and for different reasons.

```mermaid
flowchart TD
    subgraph "Container Level"
        A[Container Running] --> B{Memory Usage<br/>Exceeds Limit?}
        B -->|Yes| C[Linux OOM Killer<br/>Activated]
        C --> D[Process Inside Container<br/>Killed by Kernel]
        D --> E[Container Status:<br/>OOMKilled]
        E --> F[Container Restart<br/>by Kubelet]
        F --> G{Restart Count<br/>< Threshold?}
        G -->|Yes| H[Pod Running<br/>CrashLoopBackOff if repeated]
        G -->|No| I[Pod CrashLoopBackOff<br/>Backoff Increases]
        H --> A
        I --> J{Node Has<br/>Memory Pressure?}
    end
    
    subgraph "Node Level"
        K[Kubelet Monitors Node] --> L{Node Memory<br/>Available < Threshold?}
        L -->|No| K
        L -->|Yes| M[Node Memory Pressure]
        M --> N[Kubelet Selects Pods<br/>by QoS Priority]
        N --> O{Pod QoS Class?}
        O -->|BestEffort| P[Highest Eviction Priority]
        O -->|Burstable| Q[Medium Eviction Priority]
        O -->|Guaranteed| R[Lowest Eviction Priority]
        P --> S[Pod Evicted]
        Q --> S
        R --> S
        S --> T[Pod Status: Failed<br/>Reason: Evicted]
        T --> U[Controller Reschedules<br/>on Different Node]
    end
    
    J -->|Yes| M
    
    subgraph "Key Differences"
        V["OOMKill:<br/>- Container exceeds limit<br/>- Kernel kills process<br/>- Pod restarts on SAME node<br/>- Fast (immediate)<br/>- Container-level issue"]
        W["Eviction:<br/>- Node runs out of memory<br/>- Kubelet evicts pod<br/>- Pod reschedules to DIFFERENT node<br/>- Slower (after grace period)<br/>- Node-level issue"]
    end
```

**Critical Differences:**

| Aspect | OOMKill | Eviction |
|--------|---------|----------|
| **Trigger** | Container exceeds memory limit | Node memory pressure |
| **Level** | Container/cgroup level | Node level |
| **Actor** | Linux kernel OOM killer | Kubelet |
| **Speed** | Immediate | After grace period (soft) or immediate (hard) |
| **Pod Location** | Restarts on same node | Reschedules to different node |
| **Status Reason** | `OOMKilled` | `Evicted` |
| **Exit Code** | 137 (128 + 9 SIGKILL) | Container stopped gracefully |

### Getting Notified of Potential Eviction

Monitoring and alerting on eviction indicators helps prevent service disruption.

```mermaid
flowchart TD
    subgraph "Monitoring Sources"
        A[Node Conditions API] --> B[MemoryPressure<br/>DiskPressure<br/>PIDPressure]
        C[Kubernetes Events] --> D[Eviction Events<br/>OOMKilled Events<br/>Failed Events]
        E[Metrics Server / Prometheus] --> F[Node Memory Usage<br/>Pod Memory Usage<br/>QoS Metrics]
        G[Kubelet Logs] --> H[Eviction Manager Logs<br/>Threshold Violations]
    end
    
    subgraph "Alert Conditions"
        B --> I{Node Condition<br/>= True?}
        D --> J{Event Reason<br/>= Evicted?}
        F --> K{Memory Available<br/>< Threshold?}
        H --> L{Eviction Threshold<br/>Crossed?}
    end
    
    I -->|Yes| M[Alert: Node Under Pressure]
    J -->|Yes| N[Alert: Pod Evicted]
    K -->|Yes| O[Alert: Low Memory]
    L -->|Yes| P[Alert: Eviction Imminent]
    
    subgraph "Notification Methods"
        M --> Q[Prometheus AlertManager]
        N --> Q
        O --> Q
        P --> Q
        
        Q --> R[PagerDuty<br/>Slack<br/>Email<br/>Webhook]
        
        Q --> S[Kubectl Watch<br/>kubectl get events --watch]
        Q --> T[Monitoring Dashboard<br/>Grafana<br/>Datadog<br/>New Relic]
    end
    
    subgraph "Proactive Monitoring Commands"
        U["kubectl describe nodes<br/>| grep Pressure"] --> V[Check Node Conditions]
        W["kubectl top nodes"] --> X[Check Resource Usage]
        Y["kubectl get events -A<br/>--field-selector reason=Evicted"] --> Z[View Eviction History]
        AA["kubectl get pods -A<br/>--field-selector status.phase=Failed"] --> AB[Find Failed Pods]
    end
```

**Key Monitoring Queries:**

```bash
# Check node conditions for pressure
kubectl describe nodes | grep -A 5 "Conditions:"

# Watch for eviction events in real-time
kubectl get events -A --watch --field-selector reason=Evicted

# Check recent evictions
kubectl get events -A --sort-by='.lastTimestamp' | grep -i evict

# Monitor node memory available
kubectl top nodes

# Check pods close to their limits
kubectl top pods -A --containers
```

**Prometheus Alerting Example:**

```yaml
# Alert when node has memory pressure
- alert: NodeMemoryPressure
  expr: kube_node_status_condition{condition="MemoryPressure",status="true"} == 1
  for: 5m
  annotations:
    summary: "Node {{ $labels.node }} has memory pressure"

# Alert when pods are being evicted
- alert: PodEvicted
  expr: increase(kube_pod_status_reason{reason="Evicted"}[5m]) > 0
  annotations:
    summary: "Pod {{ $labels.pod }} evicted in {{ $labels.namespace }}"
```

### How to Trigger Eviction Manually

Understanding manual eviction helps with testing, maintenance, and troubleshooting.

```mermaid
flowchart TD
    subgraph "Manual Eviction Methods"
        A[Administrator Decision] --> B{Eviction Method?}
        
        B -->|kubectl delete| C[kubectl delete pod POD_NAME]
        C --> D[Immediate Deletion<br/>Default Grace: 30s]
        D --> E[Pod Terminated]
        
        B -->|kubectl drain| F[kubectl drain NODE_NAME<br/>--ignore-daemonsets]
        F --> G[Evict All Pods from Node<br/>Respect PodDisruptionBudgets]
        G --> H[Node Marked Unschedulable]
        H --> I[Pods Rescheduled<br/>to Other Nodes]
        
        B -->|Eviction API| J[kubectl create -f eviction.yaml]
        J --> K["apiVersion: policy/v1<br/>kind: Eviction<br/>metadata:<br/>  name: POD_NAME"]
        K --> L[Respects PodDisruptionBudgets]
        L --> M[Graceful Pod Eviction]
        
        B -->|Memory Pressure| N[Artificially Create<br/>Memory Pressure]
        N --> O[Deploy Memory Hog Pod:<br/>stress --vm 1 --vm-bytes 8G]
        O --> P[Node Memory < Threshold]
        P --> Q[Kubelet Triggers<br/>Automatic Eviction]
        
        B -->|Taint Node| R[kubectl taint nodes NODE_NAME<br/>key=value:NoExecute]
        R --> S[Pods Without Toleration<br/>Evicted Immediately]
    end
    
    subgraph "Testing Eviction Behavior"
        T[Create Test Namespace] --> U[Deploy Mixed QoS Pods]
        U --> V[Generate Memory Pressure]
        V --> W[Monitor Eviction Order]
        W --> X[Verify BestEffort<br/>Evicted First]
        X --> Y[Verify Burstable<br/>Evicted Second]
        Y --> Z[Verify Guaranteed<br/>Evicted Last]
    end
    
    subgraph "Safety Considerations"
        AA[Check PodDisruptionBudgets] --> AB{PDB Allows<br/>Eviction?}
        AB -->|No| AC[Eviction Blocked<br/>Until PDB Satisfied]
        AB -->|Yes| AD[Proceed with Eviction]
        
        AE[Check Critical Pods] --> AF{System Pods<br/>or DaemonSets?}
        AF -->|Yes| AG[Use --ignore-daemonsets<br/>flag]
        AF -->|No| AD
    end
```

**Manual Eviction Commands:**

```bash
# 1. Simple pod deletion (most common)
kubectl delete pod POD_NAME -n NAMESPACE

# 2. Drain a node (for maintenance)
kubectl drain NODE_NAME --ignore-daemonsets --delete-emptydir-data

# 3. Use Eviction API (respects PDBs)
kubectl create -f - <<EOF
apiVersion: policy/v1
kind: Eviction
metadata:
  name: POD_NAME
  namespace: NAMESPACE
EOF

# 4. Simulate memory pressure (automatic eviction)
kubectl run memory-hog --image=polinux/stress --restart=Never -- \
  stress --vm 1 --vm-bytes 8G --vm-hang 300

# 5. Taint node to evict pods
kubectl taint nodes NODE_NAME evict=true:NoExecute

# 6. Force delete stuck pod (last resort)
kubectl delete pod POD_NAME -n NAMESPACE --force --grace-period=0
```

### How Container Restart Failures Lead to Eviction

When containers repeatedly fail to restart due to insufficient memory, eviction helps reschedule the pod.

```mermaid
flowchart TD
    A[Pod Running Normally] --> B[Container OOMKilled<br/>Exceeds Memory Limit]
    B --> C[Kubelet Attempts<br/>Container Restart]
    C --> D{Restart Successful?}
    
    D -->|Yes| E[Pod Running Again]
    E --> F{Memory Available<br/>on Node?}
    F -->|Sufficient| A
    F -->|Node Memory Low| G[Container OOMKilled Again]
    G --> H[Restart Count++]
    H --> I{Restart Count<br/>Threshold?}
    
    D -->|No: Not Enough Memory| J[Restart Failed<br/>Cannot Start Container]
    J --> K[Backoff Delay Increases<br/>10s → 20s → 40s → 80s → 160s → 300s max]
    K --> L[Pod Status:<br/>CrashLoopBackOff]
    
    I -->|< 5 restarts| C
    I -->|>= 5 restarts| M[Pod in CrashLoopBackOff<br/>High Restart Count]
    
    L --> N{Node Under<br/>Memory Pressure?}
    M --> N
    
    N -->|No| O[Pod Stays on Node<br/>Continues Restart Attempts<br/>with Backoff]
    
    N -->|Yes| P[Kubelet Eviction Manager<br/>Evaluates Pods]
    P --> Q{Pod QoS Class?}
    
    Q -->|BestEffort| R[High Priority for Eviction<br/>No Memory Reservation]
    Q -->|Burstable| S[Medium Priority<br/>Exceeding Request?]
    Q -->|Guaranteed| T[Low Priority for Eviction<br/>Within Reserved Memory]
    
    R --> U[Pod Evicted]
    S --> V{Memory Usage ><br/>Memory Request?}
    V -->|Yes| U
    V -->|No| W[Lower Eviction Priority]
    T --> X[Only Evicted if<br/>All Other Options Exhausted]
    
    U --> Y[Pod Status: Failed<br/>Reason: Evicted]
    Y --> Z[Deployment Controller<br/>Creates New Pod]
    Z --> AA{Scheduler Finds<br/>Node with Memory?}
    
    AA -->|Yes| AB[Pod Scheduled on<br/>Different Node with Memory]
    AB --> AC[Pod Starts Successfully]
    
    AA -->|No| AD[Pod Status: Pending<br/>Insufficient Memory]
    AD --> AE{Cluster Autoscaler<br/>Enabled?}
    
    AE -->|Yes| AF[Cluster Autoscaler<br/>Provisions New Node]
    AF --> AG[New Node Added<br/>with Available Memory]
    AG --> AB
    
    AE -->|No| AH[Pod Remains Pending<br/>Manual Intervention Needed]
    
    subgraph "Key Insight"
        AI["Eviction breaks the CrashLoopBackOff cycle<br/>by moving the pod to a node with resources"]
    end
```

**Why Eviction Helps in CrashLoopBackOff:**

1. **Problem:** Pod stuck in CrashLoopBackOff on a node without enough memory
2. **Without Eviction:** Pod keeps trying to restart on the same node, failing repeatedly
3. **With Eviction:** 
   - Kubelet evicts the failing pod from the memory-starved node
   - Controller reschedules pod to a different node with available memory
   - Pod has a chance to start successfully

**Monitoring CrashLoopBackOff and Evictions:**

```bash
# Find pods in CrashLoopBackOff
kubectl get pods -A --field-selector status.phase=Running | \
  grep -i crashloop

# Check restart counts (high count indicates issues)
kubectl get pods -A -o custom-columns=\
'NAME:.metadata.name,RESTARTS:.status.containerStatuses[0].restartCount,STATUS:.status.phase'

# View OOMKilled events
kubectl get events -A --sort-by='.lastTimestamp' | grep -i oom

# Check pod memory limits vs node available memory
kubectl describe pod POD_NAME | grep -A 5 "Limits:"
kubectl describe node NODE_NAME | grep -A 5 "Allocatable:"
```

## Lab Flow

```mermaid
flowchart TD
    A["1️⃣ Create Namespace"] --> B["2️⃣ Deploy Guaranteed QoS<br/>- requests == limits<br/>- Highest priority"]
    B --> C["3️⃣ Deploy Burstable QoS<br/>- requests < limits<br/>- Medium priority"]
    C --> D["4️⃣ Deploy BestEffort QoS<br/>- No requests/limits<br/>- Lowest priority"]
    D --> E["5️⃣ Mixed Deployment<br/>- All three classes<br/>- Observe behavior"]
    E --> F["6️⃣ Priority Classes<br/>- Additional control<br/>- Preemption"]
    F --> G["7️⃣ Simulate Pressure<br/>- Memory stress<br/>- Watch evictions"]
    G --> H["8️⃣ Cleanup"]
```

## Step-by-Step Guide

### 1. Deploy Guaranteed QoS (10 min)

Deploy pods with Guaranteed QoS class:

```bash
kubectl apply -f k8s/qos/step-01-guaranteed-qos.yaml
```

Verify the QoS class:

```bash
kubectl get pods -n qos-demo -l qos-class=guaranteed
kubectl describe pod -n qos-demo -l qos-class=guaranteed | grep "QoS Class"
```

**Expected Output:**
```
QoS Class:       Guaranteed
```

**Key Characteristics:**
- CPU request: 500m, CPU limit: 500m (equal)
- Memory request: 512Mi, Memory limit: 512Mi (equal)

### 2. Deploy Burstable QoS (10 min)

Deploy pods with Burstable QoS class:

```bash
kubectl apply -f k8s/qos/step-02-burstable-qos.yaml
```

Verify the QoS class:

```bash
kubectl get pods -n qos-demo -l qos-class=burstable
kubectl describe pod -n qos-demo -l qos-class=burstable | grep "QoS Class"
```

**Expected Output:**
```
QoS Class:       Burstable
```

**Key Characteristics:**
- CPU request: 200m, CPU limit: 1 (not equal)
- Memory request: 256Mi, Memory limit: 1Gi (not equal)

### 3. Deploy BestEffort QoS (10 min)

Deploy pods with BestEffort QoS class:

```bash
kubectl apply -f k8s/qos/step-03-besteffort-qos.yaml
```

Verify the QoS class:

```bash
kubectl get pods -n qos-demo -l qos-class=besteffort
kubectl describe pod -n qos-demo -l qos-class=besteffort | grep "QoS Class"
```

**Expected Output:**
```
QoS Class:       BestEffort
```

**Key Characteristics:**
- No CPU or memory requests
- No CPU or memory limits

### 4. Mixed QoS Deployment (15 min)

Deploy all three QoS classes simultaneously to observe their interaction:

```bash
kubectl apply -f k8s/qos/step-04-mixed-qos-eviction-demo.yaml
```

List all pods with their QoS classes:

```bash
kubectl get pods -n qos-demo -o custom-columns=\
'NAME:.metadata.name,QOS:.status.qosClass,CPU_REQ:.spec.containers[0].resources.requests.cpu,MEM_REQ:.spec.containers[0].resources.requests.memory,CPU_LIM:.spec.containers[0].resources.limits.cpu,MEM_LIM:.spec.containers[0].resources.limits.memory'
```

**Expected Output:**
```
NAME                           QOS          CPU_REQ   MEM_REQ   CPU_LIM   MEM_LIM
besteffort-qos-xxx            BestEffort   <none>    <none>    <none>    <none>
burstable-qos-xxx             Burstable    200m      256Mi     1         1Gi
guaranteed-qos-xxx            Guaranteed   500m      512Mi     500m      512Mi
```

### 5. Priority Classes (15 min)

Deploy pods with PriorityClasses for additional eviction control:

```bash
kubectl apply -f k8s/qos/step-05-priority-classes.yaml
```

View the priority classes:

```bash
kubectl get priorityclass
```

Check pod priorities:

```bash
kubectl get pods -n qos-demo -o custom-columns=\
'NAME:.metadata.name,PRIORITY:.spec.priorityClassName,QOS:.status.qosClass,VALUE:.spec.priority'
```

**Understanding Priority:**
- **High Priority (1000000) + Guaranteed QoS** = Maximum protection
- **Low Priority (100000) + BestEffort QoS** = First to be evicted/preempted

### 6. Simulate Resource Pressure (25 min)

Generate memory pressure to observe eviction behavior:

```bash
# Port-forward to each service
kubectl port-forward -n qos-demo svc/besteffort-qos 8081:80 &
kubectl port-forward -n qos-demo svc/burstable-qos 8082:80 &
kubectl port-forward -n qos-demo svc/guaranteed-qos 8083:80 &
```

Trigger memory stress on all pods:

```bash
# BestEffort pods - will consume unbounded memory
curl -X POST http://localhost:8081/api/stress/memory \
  -H "Content-Type: application/json" \
  -d '{"minutes": 10, "targetMegabytes": 800}'

# Burstable pods - will try to burst beyond requests
curl -X POST http://localhost:8082/api/stress/memory \
  -H "Content-Type: application/json" \
  -d '{"minutes": 10, "targetMegabytes": 600}'

# Guaranteed pods - stay within limits
curl -X POST http://localhost:8083/api/stress/memory \
  -H "Content-Type: application/json" \
  -d '{"minutes": 10, "targetMegabytes": 400}'
```

**Monitor Evictions:**

Watch for pod evictions and OOMKilled events:

```bash
# Watch pod status
kubectl get pods -n qos-demo -w

# Check eviction events
kubectl get events -n qos-demo --sort-by='.lastTimestamp' | grep -i evict

# Check for OOM kills
kubectl get events -n qos-demo --sort-by='.lastTimestamp' | grep -i oom
```

**Expected Behavior:**
1. BestEffort pods evicted first (or OOMKilled)
2. Burstable pods evicted second if pressure continues
3. Guaranteed pods remain running (evicted last resort)

### 7. Analyze Node Conditions (10 min)

Check node memory pressure and eviction thresholds:

```bash
# View node conditions
kubectl describe nodes | grep -A 10 "Conditions:"

# Check for MemoryPressure condition
kubectl get nodes -o custom-columns=\
'NAME:.metadata.name,MEMORY_PRESSURE:.status.conditions[?(@.type=="MemoryPressure")].status'

# View kubelet eviction thresholds
kubectl get --raw "/api/v1/nodes/<node-name>/proxy/configz" | grep -i eviction
```

### 8. Cleanup (5 min)

Remove all QoS demo resources:

```bash
kubectl delete -f k8s/qos/step-05-priority-classes.yaml
kubectl delete -f k8s/qos/step-04-mixed-qos-eviction-demo.yaml
kubectl delete namespace qos-demo
```

## Key Concepts

### Resource Accounting

```yaml
# Guaranteed: requests == limits for ALL resources
resources:
  requests:
    cpu: "500m"
    memory: "512Mi"
  limits:
    cpu: "500m"      # Must equal request
    memory: "512Mi"  # Must equal request

# Burstable: requests < limits (or only requests specified)
resources:
  requests:
    cpu: "200m"
    memory: "256Mi"
  limits:
    cpu: "1"         # Greater than request
    memory: "1Gi"    # Greater than request

# BestEffort: no requests or limits
resources: {}
```

### Eviction Signals

The kubelet monitors these signals to trigger evictions:

- `memory.available` - Available memory on the node
- `nodefs.available` - Available disk space on node filesystem
- `nodefs.inodesFree` - Available inodes on node filesystem
- `imagefs.available` - Available disk space on image filesystem

### Eviction Thresholds

Default soft eviction thresholds:
- `memory.available < 100Mi`
- `nodefs.available < 10%`

Hard eviction happens immediately, soft eviction has grace periods.

## Best Practices

### 1. **Critical Workloads → Guaranteed QoS**
```yaml
# Always use Guaranteed for:
# - Databases
# - State stores
# - Critical API services

resources:
  requests:
    memory: "2Gi"
    cpu: "1"
  limits:
    memory: "2Gi"
    cpu: "1"
```

### 2. **Standard Services → Burstable QoS**
```yaml
# Use Burstable for:
# - Web applications
# - API services
# - Worker processes

resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "2"
```

### 3. **Batch Jobs → BestEffort QoS**
```yaml
# Use BestEffort only for:
# - Development environments
# - Non-critical batch jobs
# - Background tasks that can be interrupted

resources: {}
```

### 4. **Combine with Priority Classes**
```yaml
# Critical production workload
spec:
  priorityClassName: high-priority
  containers:
  - name: app
    resources:
      requests:
        memory: "1Gi"
        cpu: "500m"
      limits:
        memory: "1Gi"
        cpu: "500m"
```

### 5. **Use Pod Disruption Budgets (PDBs)**
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: critical-app-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: critical-app
```

## Troubleshooting

### Pod Evicted Unexpectedly

```bash
# Check pod events for eviction reason
kubectl describe pod <pod-name> -n <namespace>

# Look for these reasons:
# - Evicted: Node was under memory pressure
# - OOMKilled: Container exceeded memory limit
# - NodeNotReady: Node became unready
```

### Understanding Eviction Events

```bash
# View all eviction events
kubectl get events --all-namespaces --field-selector reason=Evicted

# Detailed event information
kubectl get events -n <namespace> -o json | jq '.items[] | select(.reason=="Evicted")'
```

### Checking Resource Usage

```bash
# Node resource usage
kubectl top nodes

# Pod resource usage
kubectl top pods -n qos-demo

# Container resource usage (detailed)
kubectl describe pod <pod-name> -n qos-demo | grep -A 5 "Containers:"
```

## Common Scenarios

### Scenario 1: Out of Memory (OOM)
- **Guaranteed Pod:** Killed if exceeds limit, restarted by kubelet
- **Burstable Pod:** Evicted or killed if exceeds limit or node has pressure
- **BestEffort Pod:** First to be evicted when node has memory pressure

### Scenario 2: Node Disk Pressure
- Same eviction order applies (BestEffort → Burstable → Guaranteed)
- Check disk usage: `kubectl describe node | grep -A 5 "Allocatable:"`

### Scenario 3: CPU Throttling
- CPU limits cause throttling, not eviction
- Monitor: `kubectl top pods` and check CPU usage vs limits
- BestEffort pods can use all available CPU (no limit)

## Additional Resources

- [Kubernetes QoS Classes](https://kubernetes.io/docs/tasks/configure-pod-container/quality-service-pod/)
- [Node-pressure Eviction](https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/)
- [Pod Priority and Preemption](https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/)
- [Resource Management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
