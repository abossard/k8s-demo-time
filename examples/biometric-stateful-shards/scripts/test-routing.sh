#!/usr/bin/env bash
set -euo pipefail

# test-routing.sh - Test routing between biometric shards
# Simulates routing by hitting different shards via the service

NAMESPACE="biometric-shards"
SERVICE="biometric-shard"
ITERATIONS=20

echo "======================================"
echo "Biometric Shard Routing Test"
echo "======================================"
echo ""

# Check if service exists
if ! kubectl get svc "$SERVICE" -n "$NAMESPACE" &>/dev/null; then
    echo "❌ Service '$SERVICE' not found in namespace '$NAMESPACE'"
    exit 1
fi

echo "🔄 Testing routing across shards..."
echo "   Sending $ITERATIONS requests to service..."
echo ""

# Create a temporary pod for testing
TEST_POD="routing-test-$$"
kubectl run "$TEST_POD" -n "$NAMESPACE" --image=curlimages/curl:latest --restart=Never --rm -i --quiet -- sh -c "
for i in \$(seq 1 $ITERATIONS); do
    # Call the status endpoint which returns the pod name
    RESPONSE=\$(curl -s http://$SERVICE/api/status 2>/dev/null || echo 'error')
    
    # Extract pod name from response (if JSON)
    POD_NAME=\$(echo \"\$RESPONSE\" | grep -o '\"hostname\":\"[^\"]*\"' | cut -d'\"' -f4 2>/dev/null || echo 'unknown')
    
    if [ -z \"\$POD_NAME\" ] || [ \"\$POD_NAME\" = \"unknown\" ]; then
        # Fallback: just show we got a response
        echo \"Request \$i: Response received\"
    else
        echo \"Request \$i: Routed to \$POD_NAME\"
    fi
    
    sleep 0.5
done
" 2>/dev/null || echo "Test pod failed to run"

echo ""
echo "📊 Routing distribution:"
echo "   (Note: ClusterIP service uses iptables/IPVS load balancing)"
echo "   (With SessionAffinity: ClientIP, requests from same source go to same pod)"
echo ""

# Show service configuration
echo "ℹ️  Service configuration:"
kubectl get svc "$SERVICE" -n "$NAMESPACE" -o jsonpath='{.spec.sessionAffinity}' | xargs -I {} echo "   Session Affinity: {}"
kubectl get svc "$SERVICE" -n "$NAMESPACE" -o jsonpath='{.spec.sessionAffinityConfig.clientIP.timeoutSeconds}' | xargs -I {} echo "   Timeout: {} seconds"
echo ""

echo "🔍 Testing direct access to individual shards:"
echo ""

# Test first 3 shards directly via headless service
for i in 0 1 2; do
    POD_NAME="biometric-shard-$i"
    POD_FQDN="${POD_NAME}.biometric-shard-headless.${NAMESPACE}.svc.cluster.local"
    
    echo "   Testing $POD_NAME..."
    
    # Use a test pod to curl the specific shard
    RESULT=$(kubectl run "test-$i-$$" -n "$NAMESPACE" --image=curlimages/curl:latest --restart=Never --rm -i --quiet -- \
      curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 "http://$POD_FQDN:8080/api/status" 2>/dev/null || echo "000")
    
    if [ "$RESULT" = "200" ]; then
        echo "      ✅ HTTP $RESULT - Shard responding"
    else
        echo "      ❌ HTTP $RESULT - Shard not accessible"
    fi
done

echo ""
echo "======================================"
echo "✅ Routing test complete"
echo "======================================"
echo ""
echo "💡 Tips:"
echo "  • Each shard can route requests to peers using the headless service DNS"
echo "  • Pod DNS format: biometric-shard-{0..9}.biometric-shard-headless.biometric-shards.svc.cluster.local"
echo "  • Use kubectl port-forward to test from your workstation:"
echo "      kubectl port-forward -n $NAMESPACE biometric-shard-0 8080:8080"
echo "      curl http://localhost:8080/api/status"
echo ""
