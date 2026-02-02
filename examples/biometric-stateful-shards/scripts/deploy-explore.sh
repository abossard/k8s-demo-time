#!/usr/bin/env bash
set -euo pipefail

# deploy-explore.sh - Deploy biometric shards in explore phase
# This script deploys all base resources and the explore overlay

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_BASE_DIR="$SCRIPT_DIR/../k8s/base"
K8S_EXPLORE_DIR="$SCRIPT_DIR/../k8s/overlays/explore"

echo "======================================"
echo "Deploying Biometric Shards - Explore Phase"
echo "======================================"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl."
    exit 1
fi
echo "✅ kubectl found"

# Check cluster access
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot access Kubernetes cluster. Please configure kubectl."
    exit 1
fi
echo "✅ Cluster access verified"

# Check if AKS Node Auto Provisioning (Karpenter-compatible CRDs) is available
if ! kubectl get crd nodepools.karpenter.sh &> /dev/null || ! kubectl get crd aksnodeclasses.karpenter.azure.com &> /dev/null; then
    echo "⚠️  Warning: AKS Node Auto Provisioning (NAP) CRDs not found."
    echo "   This example expects the Karpenter-compatible NodePool and AKSNodeClass CRDs."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "======================================"
echo "Step 1: Deploying Base Resources"
echo "======================================"
echo ""

# Apply base resources in order
for manifest in "$K8S_BASE_DIR"/*.yaml; do
    echo "Applying $(basename "$manifest")..."
    kubectl apply -f "$manifest"
done

echo ""
echo "======================================"
echo "Step 2: Deploying Explore Overlay"
echo "======================================"
echo ""

# Apply explore overlay
echo "Applying explore NodePool..."
kubectl apply -f "$K8S_EXPLORE_DIR/nodepool.yaml"

echo "Patching StatefulSet for explore affinity..."
kubectl patch statefulset biometric-shard -n biometric-shards --type=merge --patch-file "$K8S_EXPLORE_DIR/statefulset-patch.yaml"

echo ""
read -p "Deploy VPA for resource optimization? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Applying VPA in Off mode..."
    kubectl apply -f "$K8S_EXPLORE_DIR/vpa.yaml"
    echo ""
    echo "✅ VPA deployed. Run ./scripts/check-vpa-recommendations.sh after 5-10 minutes."
else
    echo "⏭️  Skipping VPA deployment."
fi

echo ""
echo "======================================"
echo "Deployment Initiated!"
echo "======================================"
echo ""
echo "⏳ Waiting for pods to be ready (this may take 5-10 minutes)..."
echo "   AKS Node Auto Provisioning (NAP) will provision nodes as needed."
echo ""

# Wait for StatefulSet to exist
kubectl wait --for=condition=Ready=false statefulset/biometric-shard -n biometric-shards --timeout=30s 2>/dev/null || true

# Wait for pods to be ready (with timeout)
if kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=shard -n biometric-shards --timeout=600s 2>/dev/null; then
    echo ""
    echo "✅ All pods are ready!"
    echo ""
else
    echo ""
    echo "⚠️  Timeout waiting for pods. They may still be starting."
    echo "   Check status with: kubectl get pods -n biometric-shards"
    echo ""
fi

echo "======================================"
echo "Next Steps:"
echo "======================================"
echo ""
echo "1. Verify the deployment:"
echo "   ./scripts/verify-cluster.sh"
echo ""
echo "2. Analyze node packing:"
echo "   ./scripts/packing-summary.sh"
echo ""
echo "3. (Optional) Check VPA recommendations after 5-10 minutes:"
echo "   ./scripts/check-vpa-recommendations.sh"
echo ""
echo "4. Test routing:"
echo "   ./scripts/test-routing.sh"
echo ""
echo "5. Observe costs:"
echo "   ./scripts/observe-costs.sh"
echo ""
echo "6. Access the dashboard:"
echo "   kubectl port-forward -n biometric-shards svc/biometric-shard 8080:80"
echo "   Open http://localhost:8080"
echo ""
