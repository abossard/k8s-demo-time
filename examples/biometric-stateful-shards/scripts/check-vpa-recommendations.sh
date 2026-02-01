#!/usr/bin/env bash
set -euo pipefail

# check-vpa-recommendations.sh - Check VPA recommendations for resource optimization
# This script retrieves VPA recommendations to help right-size resources for stable phase

NAMESPACE="biometric-shards"
VPA_NAME="biometric-shard-vpa"

echo "======================================"
echo "VPA Resource Recommendations"
echo "======================================"
echo ""

# Check if VPA exists
if ! kubectl get vpa "$VPA_NAME" -n "$NAMESPACE" &>/dev/null; then
    echo "❌ VPA '$VPA_NAME' not found in namespace '$NAMESPACE'"
    echo ""
    echo "To enable VPA recommendations during explore phase:"
    echo "  kubectl apply -f k8s/overlays/explore/vpa.yaml"
    echo ""
    exit 1
fi

echo "✅ VPA found: $VPA_NAME"
echo ""

# Get VPA status
echo "🔍 Fetching recommendations..."
echo ""

VPA_OUTPUT=$(kubectl get vpa "$VPA_NAME" -n "$NAMESPACE" -o json)

# Check if recommendations are available
RECOMMENDATIONS=$(echo "$VPA_OUTPUT" | jq -r '.status.recommendation // empty')

if [ -z "$RECOMMENDATIONS" ]; then
    echo "⚠️  No recommendations available yet."
    echo ""
    echo "VPA needs time to collect metrics (typically 5-10 minutes after deployment)."
    echo "Ensure pods have been running and processing load."
    echo ""
    echo "Check VPA status:"
    kubectl describe vpa "$VPA_NAME" -n "$NAMESPACE"
    exit 0
fi

echo "📊 VPA Recommendations for biometric-shard containers:"
echo ""

# Extract recommendations for each resource
CPU_LOWER=$(echo "$VPA_OUTPUT" | jq -r '.status.recommendation.containerRecommendations[0].lowerBound.cpu // "N/A"')
CPU_TARGET=$(echo "$VPA_OUTPUT" | jq -r '.status.recommendation.containerRecommendations[0].target.cpu // "N/A"')
CPU_UPPER=$(echo "$VPA_OUTPUT" | jq -r '.status.recommendation.containerRecommendations[0].upperBound.cpu // "N/A"')
CPU_UNCAPPED=$(echo "$VPA_OUTPUT" | jq -r '.status.recommendation.containerRecommendations[0].uncappedTarget.cpu // "N/A"')

MEM_LOWER=$(echo "$VPA_OUTPUT" | jq -r '.status.recommendation.containerRecommendations[0].lowerBound.memory // "N/A"')
MEM_TARGET=$(echo "$VPA_OUTPUT" | jq -r '.status.recommendation.containerRecommendations[0].target.memory // "N/A"')
MEM_UPPER=$(echo "$VPA_OUTPUT" | jq -r '.status.recommendation.containerRecommendations[0].upperBound.memory // "N/A"')
MEM_UNCAPPED=$(echo "$VPA_OUTPUT" | jq -r '.status.recommendation.containerRecommendations[0].uncappedTarget.memory // "N/A"')

# Convert memory to GiB for readability
convert_to_gib() {
    local value=$1
    if [[ "$value" =~ ^([0-9]+)$ ]]; then
        # Bytes
        echo "scale=2; $value / 1024 / 1024 / 1024" | bc | xargs printf "%.1fGi"
    elif [[ "$value" =~ ^([0-9]+)Ki$ ]]; then
        # KiB
        local num="${value%Ki}"
        echo "scale=2; $num / 1024 / 1024" | bc | xargs printf "%.1fGi"
    else
        echo "$value"
    fi
}

MEM_LOWER_GIB=$(convert_to_gib "$MEM_LOWER")
MEM_TARGET_GIB=$(convert_to_gib "$MEM_TARGET")
MEM_UPPER_GIB=$(convert_to_gib "$MEM_UPPER")
MEM_UNCAPPED_GIB=$(convert_to_gib "$MEM_UNCAPPED")

# Display recommendations in a table
printf "%-20s %-15s %-15s %-15s %-15s\n" "Resource" "Lower Bound" "Target" "Upper Bound" "Uncapped"
printf "%-20s %-15s %-15s %-15s %-15s\n" "====================" "===============" "===============" "===============" "==============="
printf "%-20s %-15s %-15s %-15s %-15s\n" "CPU" "$CPU_LOWER" "$CPU_TARGET" "$CPU_UPPER" "$CPU_UNCAPPED"
printf "%-20s %-15s %-15s %-15s %-15s\n" "Memory" "$MEM_LOWER_GIB" "$MEM_TARGET_GIB" "$MEM_UPPER_GIB" "$MEM_UNCAPPED_GIB"

echo ""
echo "======================================"
echo "Interpretation Guide"
echo "======================================"
echo ""
echo "📌 Lower Bound: Minimum safe resources without performance issues"
echo "🎯 Target: Recommended 'just right' value for cost/performance balance"
echo "📈 Upper Bound: Conservative maximum to prevent OOM/throttling"
echo "🚀 Uncapped: VPA's raw recommendation without min/max constraints"
echo ""

echo "======================================"
echo "Current Configuration"
echo "======================================"
echo ""

CURRENT_CPU=$(kubectl get statefulset biometric-shard -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}')
CURRENT_MEM=$(kubectl get statefulset biometric-shard -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].resources.requests.memory}')

echo "Current requests: CPU=$CURRENT_CPU, Memory=$CURRENT_MEM"
echo ""

echo "======================================"
echo "💡 Recommendations for Stable Phase"
echo "======================================"
echo ""

echo "Based on VPA analysis, consider these options for stable phase:"
echo ""
echo "1️⃣  Conservative (Upper Bound):"
echo "   - CPU: $CPU_UPPER"
echo "   - Memory: $MEM_UPPER_GIB"
echo "   - Use when: Critical workload, avoid any risk of resource starvation"
echo ""
echo "2️⃣  Balanced (Target) ⭐ RECOMMENDED:"
echo "   - CPU: $CPU_TARGET"
echo "   - Memory: $MEM_TARGET_GIB"
echo "   - Use when: Normal operation, cost-conscious"
echo ""
echo "3️⃣  Aggressive (Lower Bound):"
echo "   - CPU: $CPU_LOWER"
echo "   - Memory: $MEM_LOWER_GIB"
echo "   - Use when: Tight budget, acceptable to be closer to limits"
echo ""

echo "📝 To apply these recommendations:"
echo ""
echo "1. Update k8s/overlays/stable/statefulset-patch.yaml:"
echo "   resources:"
echo "     requests:"
echo "       cpu: \"$CPU_TARGET\"      # or choose from above"
echo "       memory: \"$MEM_TARGET_GIB\"  # or choose from above"
echo "     limits:"
echo "       cpu: \"$CPU_TARGET\"      # Same as requests for Guaranteed QoS"
echo "       memory: \"$MEM_TARGET_GIB\"  # Same as requests for Guaranteed QoS"
echo ""
echo "2. Recalculate node requirements:"
echo "   - If using lower memory, you may fit more shards per node"
echo "   - If using higher memory, you may need more nodes or larger SKUs"
echo "   - Re-run packing-summary.sh to verify"
echo ""
echo "3. Update stable NodePool accordingly"
echo ""

echo "⚠️  Important Notes:"
echo ""
echo "- VPA Auto mode is NOT recommended for this workload"
echo "- This is a VM-like workload with Guaranteed QoS and OnDelete updates"
echo "- Use VPA recommendations manually, then apply during stable phase transition"
echo "- Keep requests == limits for Guaranteed QoS"
echo ""

echo "🔗 For more details, see:"
echo "   - examples/biometric-stateful-shards/README.md#vpa-optimization"
echo "   - k8s/vpa/README.md (general VPA tutorial)"
echo ""
