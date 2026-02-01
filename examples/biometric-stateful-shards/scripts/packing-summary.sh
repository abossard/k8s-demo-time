#!/usr/bin/env bash
set -euo pipefail

# packing-summary.sh - Analyze node packing efficiency for biometric shards
# This script shows how many shards fit on each node type and calculates utilization

NAMESPACE="biometric-shards"
SHARD_MEMORY_REQUEST="32Gi"
SHARD_CPU_REQUEST="4"

echo "================================================"
echo "Biometric Shard Packing Analysis"
echo "================================================"
echo ""
echo "Shard resource requirements:"
echo "  • Memory: $SHARD_MEMORY_REQUEST per shard"
echo "  • CPU:    $SHARD_CPU_REQUEST cores per shard"
echo ""

# Get nodes running biometric shards
echo "🔍 Nodes running biometric shards:"
echo ""

NODES=$(kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/component=shard" -o json | \
  jq -r '.items[] | .spec.nodeName' | sort -u)

if [ -z "$NODES" ]; then
    echo "❌ No nodes found running biometric shards"
    exit 1
fi

# Summary table header
printf "%-40s %-20s %-10s %-15s %-15s %-10s\n" \
  "NODE NAME" "INSTANCE TYPE" "SHARDS" "MEMORY ALLOC" "CPU ALLOC" "MEMORY %"
printf "%-40s %-20s %-10s %-15s %-15s %-10s\n" \
  "========================================" "====================" "==========" "===============" "===============" "=========="

TOTAL_NODES=0
TOTAL_SHARDS=0

# Analyze each node
for NODE in $NODES; do
    TOTAL_NODES=$((TOTAL_NODES + 1))
    
    # Get node information
    NODE_INFO=$(kubectl get node "$NODE" -o json)
    
    # Extract instance type (Azure VM size)
    INSTANCE_TYPE=$(echo "$NODE_INFO" | jq -r '.metadata.labels["node.kubernetes.io/instance-type"] // .metadata.labels["beta.kubernetes.io/instance-type"] // "unknown"')
    
    # Get allocatable resources
    ALLOCATABLE_MEMORY_KB=$(echo "$NODE_INFO" | jq -r '.status.allocatable.memory' | sed 's/Ki$//' 2>/dev/null || echo "0")
    ALLOCATABLE_CPU=$(echo "$NODE_INFO" | jq -r '.status.allocatable.cpu' | sed 's/m$//' 2>/dev/null || echo "0")
    
    # Convert to GiB and cores
    ALLOCATABLE_MEMORY_GIB=$(awk "BEGIN {printf \"%.1f\", $ALLOCATABLE_MEMORY_KB / 1024 / 1024}")
    ALLOCATABLE_CPU_CORES=$(awk "BEGIN {printf \"%.1f\", $ALLOCATABLE_CPU / 1000}")
    
    # Count shards on this node
    SHARD_COUNT=$(kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/component=shard" --field-selector spec.nodeName="$NODE" --no-headers 2>/dev/null | wc -l)
    TOTAL_SHARDS=$((TOTAL_SHARDS + SHARD_COUNT))
    
    # Calculate used resources (approximate)
    USED_MEMORY_GIB=$(awk "BEGIN {printf \"%.1f\", $SHARD_COUNT * 32}")
    USED_CPU_CORES=$(awk "BEGIN {printf \"%.1f\", $SHARD_COUNT * 4}")
    
    # Calculate utilization percentage
    MEMORY_UTIL=$(awk "BEGIN {printf \"%.0f\", ($USED_MEMORY_GIB / $ALLOCATABLE_MEMORY_GIB) * 100}")
    
    # Print row
    printf "%-40s %-20s %-10s %-15s %-15s %-10s\n" \
      "$NODE" \
      "$INSTANCE_TYPE" \
      "$SHARD_COUNT" \
      "${USED_MEMORY_GIB}Gi / ${ALLOCATABLE_MEMORY_GIB}Gi" \
      "${USED_CPU_CORES} / ${ALLOCATABLE_CPU_CORES}" \
      "${MEMORY_UTIL}%"
done

echo ""
echo "================================================"
echo "Summary:"
echo "  • Total nodes: $TOTAL_NODES"
echo "  • Total shards: $TOTAL_SHARDS"
echo "  • Average shards per node: $(awk "BEGIN {printf \"%.1f\", $TOTAL_SHARDS / $TOTAL_NODES}")"
echo "================================================"
echo ""

# Get unique instance types and count
echo "📊 Instance type distribution:"
kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/component=shard" -o json | \
  jq -r '.items[] | .spec.nodeName' | sort | uniq | while read -r NODE; do
    kubectl get node "$NODE" -o json | jq -r '.metadata.labels["node.kubernetes.io/instance-type"] // .metadata.labels["beta.kubernetes.io/instance-type"] // "unknown"'
  done | sort | uniq -c | sort -rn
echo ""

# Suggest optimal SKU for stable phase
echo "💡 Suggestions for stable phase:"
echo ""

# Find most common instance type
MOST_COMMON_SKU=$(kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/component=shard" -o json | \
  jq -r '.items[] | .spec.nodeName' | sort | uniq | while read -r NODE; do
    kubectl get node "$NODE" -o json | jq -r '.metadata.labels["node.kubernetes.io/instance-type"] // .metadata.labels["beta.kubernetes.io/instance-type"] // "unknown"'
  done | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')

AVG_SHARDS_PER_NODE=$(awk "BEGIN {printf \"%.0f\", $TOTAL_SHARDS / $TOTAL_NODES}")

echo "  1. Most used instance type: $MOST_COMMON_SKU"
echo "  2. Average packing: $AVG_SHARDS_PER_NODE shards per node"
echo "  3. Estimated node count for stable: $(awk "BEGIN {printf \"%.0f\", 10 / $AVG_SHARDS_PER_NODE + 0.5}") nodes"
echo ""
echo "  To pin to this SKU in stable phase:"
echo "    • Edit k8s/overlays/stable/nodepool.yaml"
echo "    • Set karpenter.azure.com/sku-family and sku-memory to match $MOST_COMMON_SKU"
echo "    • Update limits.cpu and limits.memory in NodePool"
echo ""

# Cost estimation hint
echo "💰 Cost analysis:"
echo "  Run 'aks-node-viewer' to see real-time cost and utilization:"
echo "    kubectl get nodes -o wide"
echo "    # Install aks-node-viewer: https://github.com/Azure/aks-node-viewer"
echo "    aks-node-viewer"
echo ""
echo "  Or check Azure portal for VM pricing:"
echo "    https://azure.microsoft.com/pricing/details/virtual-machines/linux/"
echo ""
