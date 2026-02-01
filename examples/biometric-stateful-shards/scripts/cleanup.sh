#!/usr/bin/env bash
set -euo pipefail

# cleanup.sh - Remove all biometric shard resources
# WARNING: This will delete all pods, PVCs, and data!

NAMESPACE="biometric-shards"

echo "======================================"
echo "Biometric Shards Cleanup"
echo "======================================"
echo ""
echo "⚠️  WARNING: This will delete:"
echo "   • All 10 biometric shard pods"
echo "   • All PersistentVolumeClaims and data"
echo "   • NodePools (nodes will be drained)"
echo "   • Namespace and all resources"
echo ""
read -p "Are you sure you want to continue? (yes/NO) " -r
echo

if [ "$REPLY" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "🗑️  Deleting StatefulSet..."
kubectl delete statefulset biometric-shard -n "$NAMESPACE" --ignore-not-found=true

echo ""
echo "🗑️  Deleting Services..."
kubectl delete service biometric-shard biometric-shard-headless -n "$NAMESPACE" --ignore-not-found=true

echo ""
echo "🗑️  Deleting PodDisruptionBudget..."
kubectl delete pdb biometric-shard -n "$NAMESPACE" --ignore-not-found=true

echo ""
echo "🗑️  Deleting PersistentVolumeClaims (DATA LOSS!)..."
kubectl delete pvc -l app.kubernetes.io/component=shard-storage -n "$NAMESPACE" --ignore-not-found=true

echo ""
echo "🗑️  Deleting NodePools..."
kubectl delete nodepool biometric-explore --ignore-not-found=true
kubectl delete nodepool biometric-stable --ignore-not-found=true

echo ""
echo "⏳ Waiting for nodes to drain (this may take a few minutes)..."
sleep 10

echo ""
echo "🗑️  Deleting Namespace..."
kubectl delete namespace "$NAMESPACE" --ignore-not-found=true

echo ""
echo "🗑️  Deleting PriorityClass..."
kubectl delete priorityclass biometric-critical --ignore-not-found=true

echo ""
echo "======================================"
echo "✅ Cleanup complete!"
echo "======================================"
echo ""
echo "All biometric shard resources have been removed."
echo "Karpenter will automatically clean up empty nodes."
echo ""
