#!/usr/bin/env bash
set -euo pipefail

# verify-cluster.sh - Verify biometric shard cluster is healthy
# This script checks that all 10 shards are running and can discover each other

NAMESPACE="biometric-shards"
STATEFULSET="biometric-shard"
EXPECTED_REPLICAS=10
SERVICE_NAME="biometric-shard-headless"

echo "======================================"
echo "Biometric Shard Cluster Verification"
echo "======================================"
echo ""

# Check namespace exists
echo "🔍 Checking namespace..."
if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
    echo "❌ Namespace '$NAMESPACE' not found"
    exit 1
fi
echo "✅ Namespace exists"
echo ""

# Check StatefulSet exists
echo "🔍 Checking StatefulSet..."
if ! kubectl get statefulset "$STATEFULSET" -n "$NAMESPACE" &>/dev/null; then
    echo "❌ StatefulSet '$STATEFULSET' not found"
    exit 1
fi
echo "✅ StatefulSet exists"
echo ""

# Check replica count
echo "🔍 Checking replicas..."
CURRENT_REPLICAS=$(kubectl get statefulset "$STATEFULSET" -n "$NAMESPACE" -o jsonpath='{.status.replicas}' 2>/dev/null || echo "0")
READY_REPLICAS=$(kubectl get statefulset "$STATEFULSET" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")

echo "   Expected: $EXPECTED_REPLICAS"
echo "   Current:  $CURRENT_REPLICAS"
echo "   Ready:    $READY_REPLICAS"
echo ""

if [ "$CURRENT_REPLICAS" != "$EXPECTED_REPLICAS" ]; then
    echo "⚠️  Warning: Current replicas ($CURRENT_REPLICAS) != Expected ($EXPECTED_REPLICAS)"
fi

if [ "$READY_REPLICAS" != "$EXPECTED_REPLICAS" ]; then
    echo "❌ Not all replicas are ready ($READY_REPLICAS/$EXPECTED_REPLICAS)"
    echo ""
    echo "Pod status:"
    kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/component=shard" -o wide
    exit 1
fi
echo "✅ All $EXPECTED_REPLICAS replicas are ready"
echo ""

# Check pod distribution across nodes
echo "🔍 Checking pod distribution..."
echo ""
kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/component=shard" -o wide
echo ""

# Count pods per node
echo "📊 Pods per node:"
kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/component=shard" -o json | \
  jq -r '.items[] | .spec.nodeName' | sort | uniq -c | sort -rn
echo ""

# Check DNS resolution for peer discovery
echo "🔍 Verifying DNS-based peer discovery..."
echo "   Testing from biometric-shard-0..."

# Run nslookup inside the first pod to verify headless service DNS
kubectl exec -n "$NAMESPACE" "$STATEFULSET-0" -- sh -c "
  echo 'Testing headless service DNS resolution...'
  nslookup $SERVICE_NAME.$NAMESPACE.svc.cluster.local || true
" 2>/dev/null || echo "⚠️  Note: nslookup may not be available in minimal container images"

echo ""

# Test individual pod DNS names
echo "🔍 Testing individual pod DNS names..."
for i in $(seq 0 $((EXPECTED_REPLICAS - 1))); do
    POD_FQDN="${STATEFULSET}-${i}.${SERVICE_NAME}.${NAMESPACE}.svc.cluster.local"
    if kubectl exec -n "$NAMESPACE" "$STATEFULSET-0" -- getent hosts "$POD_FQDN" &>/dev/null; then
        echo "   ✅ $POD_FQDN resolves"
    else
        # Try alternative method using curl
        if kubectl exec -n "$NAMESPACE" "$STATEFULSET-0" -- sh -c "curl -s -o /dev/null -w '%{http_code}' --connect-timeout 2 http://$POD_FQDN:8080/health/startup" &>/dev/null; then
            echo "   ✅ $POD_FQDN is reachable"
        else
            echo "   ❌ $POD_FQDN not reachable"
        fi
    fi
done
echo ""

# Check PVCs
echo "🔍 Checking PersistentVolumeClaims..."
PVC_COUNT=$(kubectl get pvc -n "$NAMESPACE" -l "app.kubernetes.io/component=shard-storage" --no-headers | wc -l)
echo "   PVC count: $PVC_COUNT / $EXPECTED_REPLICAS"
if [ "$PVC_COUNT" != "$EXPECTED_REPLICAS" ]; then
    echo "⚠️  Warning: PVC count mismatch"
fi
kubectl get pvc -n "$NAMESPACE" -l "app.kubernetes.io/component=shard-storage" --no-headers | head -5
if [ "$PVC_COUNT" -gt 5 ]; then
    echo "   ... and $((PVC_COUNT - 5)) more"
fi
echo ""

# Check PDB
echo "🔍 Checking PodDisruptionBudget..."
PDB_STATUS=$(kubectl get pdb biometric-shard -n "$NAMESPACE" -o jsonpath='{.status.currentHealthy}/{.status.desiredHealthy}' 2>/dev/null || echo "N/A")
echo "   PDB status: $PDB_STATUS"
if [ "$PDB_STATUS" = "$EXPECTED_REPLICAS/$EXPECTED_REPLICAS" ]; then
    echo "✅ PDB is satisfied"
else
    echo "⚠️  PDB may not be fully satisfied"
fi
echo ""

# Test health endpoints
echo "🔍 Testing health endpoints..."
SAMPLE_POD="$STATEFULSET-0"
echo "   Testing on $SAMPLE_POD..."

STARTUP_STATUS=$(kubectl exec -n "$NAMESPACE" "$SAMPLE_POD" -- curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/health/startup 2>/dev/null || echo "000")
READINESS_STATUS=$(kubectl exec -n "$NAMESPACE" "$SAMPLE_POD" -- curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/health/readiness 2>/dev/null || echo "000")
LIVENESS_STATUS=$(kubectl exec -n "$NAMESPACE" "$SAMPLE_POD" -- curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/health/liveness 2>/dev/null || echo "000")

echo "   - Startup:   HTTP $STARTUP_STATUS $([ "$STARTUP_STATUS" = "200" ] && echo "✅" || echo "❌")"
echo "   - Readiness: HTTP $READINESS_STATUS $([ "$READINESS_STATUS" = "200" ] && echo "✅" || echo "❌")"
echo "   - Liveness:  HTTP $LIVENESS_STATUS $([ "$LIVENESS_STATUS" = "200" ] && echo "✅" || echo "❌")"
echo ""

echo "======================================"
echo "✅ Cluster verification complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "  • Run ./scripts/packing-summary.sh to analyze node packing"
echo "  • Run ./scripts/test-routing.sh to test shard routing"
echo "  • Use kubectl port-forward to access the dashboard:"
echo "      kubectl port-forward -n $NAMESPACE svc/biometric-shard 8080:80"
echo ""
