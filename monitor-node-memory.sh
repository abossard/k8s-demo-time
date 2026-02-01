#!/bin/bash

# Monitor unallocated memory on a node every 2 seconds
# Usage: ./monitor-node-memory.sh [NODE_NAME]
# If no node name provided, uses the first node

NODE=${1:-$(kubectl get nodes -o jsonpath='{.items[0].metadata.name}')}

echo "Monitoring unallocated memory on node: $NODE"
echo "Press Ctrl+C to stop"
echo ""

while true; do
  # Get allocatable memory in bytes
  ALLOCATABLE=$(kubectl get node "$NODE" -o jsonpath='{.status.allocatable.memory}' | sed 's/Ki$//' | awk '{print $1 * 1024}')
  
  # Get total requested memory in bytes from all pods on the node
  REQUESTED=$(kubectl get pods --all-namespaces -o jsonpath="{.items[?(@.spec.nodeName=='$NODE')].spec.containers[].resources.requests.memory}" | \
    tr ' ' '\n' | \
    grep -v '^$' | \
    sed 's/Mi$//' | \
    awk '{sum += $1} END {print sum * 1024 * 1024}')
  
  # Handle empty requested (default to 0)
  REQUESTED=${REQUESTED:-0}
  
  # Calculate unallocated
  UNALLOCATED=$((ALLOCATABLE - REQUESTED))
  
  # Convert to Mi for readability
  UNALLOCATED_MI=$((UNALLOCATED / 1024 / 1024))
  ALLOCATABLE_MI=$((ALLOCATABLE / 1024 / 1024))
  REQUESTED_MI=$((REQUESTED / 1024 / 1024))
  
  # Print with timestamp
  TIMESTAMP=$(date '+%H:%M:%S')
  echo "[$TIMESTAMP] Allocatable: ${ALLOCATABLE_MI}Mi | Requested: ${REQUESTED_MI}Mi | Unallocated: ${UNALLOCATED_MI}Mi"
  
  sleep 1
done
