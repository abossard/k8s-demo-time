# Quick Reference: Biometric Stateful Shards

## Quick Start

```bash
# Deploy explore phase
cd examples/biometric-stateful-shards
./scripts/deploy-explore.sh

# Verify deployment
./scripts/verify-cluster.sh

# Analyze packing
./scripts/packing-summary.sh
```

## Essential Commands

### Deployment

```bash
# Apply base resources
kubectl apply -f k8s/base/

# Apply explore overlay
kubectl apply -f k8s/overlays/explore/

# Apply stable overlay
kubectl apply -f k8s/overlays/stable/
```

### Verification

```bash
# Check pod status
kubectl get pods -n biometric-shards -o wide

# Check StatefulSet status
kubectl get statefulset -n biometric-shards

# Check PVC status
kubectl get pvc -n biometric-shards

# Check PDB status
kubectl get pdb -n biometric-shards

# Check NodePools
kubectl get nodepool biometric-explore
kubectl get nodepool biometric-stable
```

### Monitoring

```bash
# Watch pod status
kubectl get pods -n biometric-shards -w

# Watch node provisioning
kubectl get nodes -l nodepool=biometric-explore -w

# Check resource usage
kubectl top pods -n biometric-shards
kubectl top nodes
```

### Debugging

```bash
# Describe a pod
kubectl describe pod biometric-shard-0 -n biometric-shards

# View pod logs
kubectl logs -f biometric-shard-0 -n biometric-shards

# Get events
kubectl get events -n biometric-shards --sort-by='.lastTimestamp'

# Check Karpenter logs
kubectl logs -n kube-system -l app.kubernetes.io/name=karpenter --tail=100
```

### Testing

```bash
# Port-forward to a specific shard
kubectl port-forward -n biometric-shards biometric-shard-0 8080:8080

# Test health endpoints
curl http://localhost:8080/health/startup
curl http://localhost:8080/health/readiness
curl http://localhost:8080/api/status

# Test DNS resolution from inside a pod
kubectl exec -n biometric-shards biometric-shard-0 -- \
  nslookup biometric-shard-headless.biometric-shards.svc.cluster.local
```

### Upgrades (Manual OnDelete Strategy)

```bash
# Update StatefulSet image
kubectl set image statefulset/biometric-shard \
  biometric-shard=<registry>/k8s-demo-app:<new-tag> \
  -n biometric-shards

# Delete pods one at a time (starting from highest ordinal)
for i in {9..0}; do
  kubectl delete pod biometric-shard-$i -n biometric-shards
  kubectl wait --for=condition=ready pod/biometric-shard-$i \
    -n biometric-shards --timeout=300s
  sleep 30
done
```

### Node Management

```bash
# List nodes running biometric shards
kubectl get nodes -l workload-type=biometric-shards

# Cordon a node (prevent new pods)
kubectl cordon <node-name>

# Drain a node (with PDB constraints)
kubectl drain <node-name> --ignore-daemonsets \
  --delete-emptydir-data --force

# Uncordon a node
kubectl uncordon <node-name>
```

### Cost Analysis

```bash
# View nodes with instance types
kubectl get nodes -o custom-columns=\
NAME:.metadata.name,\
INSTANCE:.metadata.labels.node\\.kubernetes\\.io/instance-type,\
ZONE:.metadata.labels.topology\\.kubernetes\\.io/zone

# Run aks-node-viewer (if installed)
aks-node-viewer --node-selector nodepool=biometric-explore
aks-node-viewer --node-selector nodepool=biometric-stable
```

### Cleanup

```bash
# Full cleanup (deletes everything including PVCs)
./scripts/cleanup.sh

# Or manual cleanup
kubectl delete statefulset biometric-shard -n biometric-shards
kubectl delete pvc -l app.kubernetes.io/component=shard-storage -n biometric-shards
kubectl delete namespace biometric-shards
kubectl delete nodepool biometric-explore biometric-stable
kubectl delete priorityclass biometric-critical
```

## Key Configuration Values

### StatefulSet
- **Replicas**: 10 (fixed, no autoscaling)
- **Memory**: 32Gi per shard (Guaranteed QoS)
- **CPU**: 4 cores per shard (Guaranteed QoS)
- **Storage**: 100Gi per shard
- **Update Strategy**: OnDelete (manual upgrades only)
- **Grace Period**: 120 seconds

### PodDisruptionBudget
- **minAvailable**: 10 (all must be available)
- **unhealthyPodEvictionPolicy**: IfHealthyBudget

### NodePool (Explore)
- **SKU Families**: D-series, E-series
- **Min Memory**: 64Gi (to fit 2 shards)
- **Min CPU**: 8 cores
- **Disruption**: WhenEmpty only

### NodePool (Stable)
- **SKU**: Pinned (configure after exploration)
- **Taint**: biometric=reserved:NoSchedule
- **Disruption**: Never

## Common Scenarios

### Scenario 1: Single Pod Failure

```bash
# System is DOWN if any pod is not ready
READY=$(kubectl get statefulset biometric-shard -n biometric-shards \
  -o jsonpath='{.status.readyReplicas}')

if [ "$READY" != "10" ]; then
  echo "SYSTEM DOWN: Only $READY/10 shards ready"
fi
```

### Scenario 2: Node Maintenance

```bash
# Option 1: Manual pod deletion (preferred)
kubectl cordon <node-name>
kubectl delete pod biometric-shard-X -n biometric-shards
kubectl wait --for=condition=ready pod/biometric-shard-X \
  -n biometric-shards --timeout=300s
kubectl uncordon <node-name>

# Option 2: Temporarily relax PDB (emergency only)
kubectl patch pdb biometric-shard -n biometric-shards \
  --type merge -p '{"spec":{"minAvailable":9}}'
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
# Restore PDB
kubectl patch pdb biometric-shard -n biometric-shards \
  --type merge -p '{"spec":{"minAvailable":10}}'
```

### Scenario 3: Scaling to Different Shard Count

```bash
# Scale to 12 shards (requires editing StatefulSet and PDB)
kubectl scale statefulset biometric-shard --replicas=12 -n biometric-shards
kubectl patch pdb biometric-shard -n biometric-shards \
  --type merge -p '{"spec":{"minAvailable":12}}'
```

### Scenario 4: Change Storage Class

```bash
# Edit StatefulSet volumeClaimTemplates
kubectl edit statefulset biometric-shard -n biometric-shards

# Note: Existing PVCs won't change - need to recreate pods
# for new storage class to take effect
```

## Useful Aliases

```bash
# Add to ~/.bashrc or ~/.zshrc

alias k='kubectl'
alias kgp='kubectl get pods -n biometric-shards'
alias kgs='kubectl get statefulset -n biometric-shards'
alias kgn='kubectl get nodes -l workload-type=biometric-shards'
alias kdp='kubectl describe pod -n biometric-shards'
alias klf='kubectl logs -f -n biometric-shards'
alias kex='kubectl exec -it -n biometric-shards'
```

## Troubleshooting Checklist

- [ ] Namespace exists: `kubectl get ns biometric-shards`
- [ ] PriorityClass exists: `kubectl get priorityclass biometric-critical`
- [ ] Services exist: `kubectl get svc -n biometric-shards`
- [ ] StatefulSet exists: `kubectl get statefulset -n biometric-shards`
- [ ] PDB exists: `kubectl get pdb -n biometric-shards`
- [ ] NodePool exists: `kubectl get nodepool`
- [ ] Karpenter is running: `kubectl get deploy -n kube-system | grep karpenter`
- [ ] All 10 pods are ready: `kubectl get pods -n biometric-shards`
- [ ] PVCs are bound: `kubectl get pvc -n biometric-shards`
- [ ] Nodes have capacity: `kubectl describe nodes`
- [ ] DNS resolution works: Test from inside pod
- [ ] Health endpoints respond: Port-forward and curl

## Performance Tuning

### For Lower Latency
```yaml
# Use Premium SSD storage class
storageClassName: managed-csi-premium

# Pin to memory-optimized E-series
karpenter.azure.com/sku-family: E

# Enable accelerated networking (automatic on most SKUs)
```

### For Cost Optimization
```yaml
# Use Standard SSD
storageClassName: managed-csi

# Allow D-series (general purpose, cheaper than E-series)
karpenter.azure.com/sku-family: D

# Pack more shards per node (if workload allows)
resources.requests.memory: 24Gi  # Instead of 32Gi
```

### For High Availability
```yaml
# Spread across zones
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule

# Use zone-redundant storage (ZRS)
# (requires Premium or Ultra disk SKU)
```

## Links

- [Full Tutorial](README.md)
- [Main Repository README](../../README.md)
- [Karpenter Documentation](https://karpenter.sh)
- [AKS Node Auto Provisioning](https://learn.microsoft.com/en-us/azure/aks/node-autoprovision)
- [StatefulSet Documentation](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
