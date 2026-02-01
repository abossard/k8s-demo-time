#!/usr/bin/env bash
set -euo pipefail

# observe-costs.sh - Commands and tools for observing node costs and utilization
# This script provides guidance on cost analysis tools for the biometric shard deployment

echo "======================================"
echo "Cost Observation Guide"
echo "======================================"
echo ""

NAMESPACE="biometric-shards"

echo "📊 Current cluster state:"
echo ""
kubectl get nodes -o wide
echo ""

echo "💰 Cost analysis tools and commands:"
echo ""
echo "1️⃣  AKS Node Viewer (Recommended)"
echo "   Real-time TUI showing cost, utilization, and pod distribution"
echo ""
echo "   Installation:"
echo "     go install github.com/Azure/aks-node-viewer@latest"
echo "     # Or download binary from: https://github.com/Azure/aks-node-viewer/releases"
echo ""
echo "   Usage:"
echo "     aks-node-viewer"
echo "     # Filter to biometric nodes:"
echo "     aks-node-viewer --node-selector nodepool=biometric-explore"
echo "     aks-node-viewer --node-selector nodepool=biometric-stable"
echo ""
echo "   Key features:"
echo "     • Real-time cost per hour and per month"
echo "     • CPU and memory utilization percentages"
echo "     • Pod distribution across nodes"
echo "     • Color-coded resource pressure indicators"
echo ""

echo "2️⃣  kubectl top nodes"
echo "   Built-in resource usage (requires metrics-server)"
echo ""
echo "   Command:"
echo "     kubectl top nodes"
kubectl top nodes 2>/dev/null || echo "     (metrics-server may not be installed)"
echo ""

echo "3️⃣  Azure Portal Cost Analysis"
echo "   Official Azure cost tracking and forecasting"
echo ""
echo "   Steps:"
echo "     1. Go to Azure Portal: https://portal.azure.com"
echo "     2. Navigate to Cost Management + Billing"
echo "     3. Select 'Cost Analysis'"
echo "     4. Filter by resource group containing your AKS cluster"
echo "     5. Group by 'Resource' or 'Resource type'"
echo "     6. Look for VM costs associated with your node pool"
echo ""

echo "4️⃣  Azure Pricing Calculator"
echo "   Estimate costs for different VM SKUs"
echo ""
echo "   URL: https://azure.microsoft.com/pricing/calculator/"
echo "   VM Pricing: https://azure.microsoft.com/pricing/details/virtual-machines/linux/"
echo ""
echo "   Compare SKUs:"
echo "     • Standard_E8s_v5:  8 vCPU, 64 GiB  (~\$0.504/hr, \$367/mo)"
echo "     • Standard_E16s_v5: 16 vCPU, 128 GiB (~\$1.008/hr, \$735/mo)"
echo "     • Standard_D8s_v5:  8 vCPU, 32 GiB  (~\$0.384/hr, \$280/mo)"
echo "     • Standard_D16s_v5: 16 vCPU, 64 GiB (~\$0.768/hr, \$560/mo)"
echo "   (Prices vary by region and are subject to change)"
echo ""

echo "5️⃣  K9s with Node Resource View"
echo "   Terminal-based Kubernetes dashboard"
echo ""
echo "   Installation:"
echo "     # macOS: brew install k9s"
echo "     # Linux: Download from https://github.com/derailed/k9s/releases"
echo ""
echo "   Usage:"
echo "     k9s"
echo "     # Press :nodes to view nodes"
echo "     # Press :pods to view pods"
echo "     # Press :namespaces, then select 'biometric-shards'"
echo "     # Press Shift-M to sort by memory usage"
echo "     # Press Shift-C to sort by CPU usage"
echo ""

echo "6️⃣  Manual calculation"
echo "   Calculate costs based on node count and SKU"
echo ""

# Get current nodes
NODES=$(kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/component=shard" -o json | \
  jq -r '.items[] | .spec.nodeName' | sort -u)

NODE_COUNT=$(echo "$NODES" | wc -l)

echo "   Current state:"
echo "     • Nodes running biometric shards: $NODE_COUNT"

# Get SKU distribution
echo ""
echo "   SKU distribution:"
for NODE in $NODES; do
    SKU=$(kubectl get node "$NODE" -o jsonpath='{.metadata.labels.node\.kubernetes\.io/instance-type}' 2>/dev/null || echo "unknown")
    PODS=$(kubectl get pods -n "$NAMESPACE" --field-selector spec.nodeName="$NODE" --no-headers 2>/dev/null | wc -l)
    echo "     • $NODE: $SKU ($PODS pods)"
done

echo ""
echo "   Monthly cost estimation:"
echo "     (Multiply node count by SKU hourly rate * 730 hours)"
echo ""

echo "======================================"
echo "📈 Optimization tips:"
echo "======================================"
echo ""
echo "• Monitor utilization over time to ensure nodes aren't over-provisioned"
echo "• Compare cost of fewer large nodes vs. more small nodes"
echo "• Consider Reserved Instances for stable workloads (up to 72% savings)"
echo "• Use Spot VMs for non-critical dev/test environments (up to 90% savings)"
echo "• Review and clean up unused PVCs regularly"
echo ""

echo "💡 For this biometric workload:"
echo "• With 10 shards @ 32Gi each, minimum memory needed: 320Gi"
echo "• Packing 2 shards/node (E8s_v5): 5 nodes needed"
echo "• Packing 3 shards/node (E16s_v5): 4 nodes needed"
echo "• Trade-off: Fewer larger nodes may be cheaper but less fault-tolerant"
echo ""
