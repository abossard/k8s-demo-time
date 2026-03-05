#!/usr/bin/env bash
# kubectl-node-resources.sh
# Shows CPU and memory requests/limits per node, broken down by namespace.
#
# Usage:
#   ./kubectl-node-resources.sh            # all nodes
#   ./kubectl-node-resources.sh mynode      # single node
#
# Requirements: kubectl, awk (standard on macOS/Linux)

set -euo pipefail

NODE_FILTER="${1:-}"

# ── Header ──────────────────────────────────────────────────────────────
printf "%-42s %-20s %10s %10s %12s %12s\n" \
  "NODE" "NAMESPACE" "CPU_REQ(m)" "CPU_LIM(m)" "MEM_REQ(Mi)" "MEM_LIM(Mi)"
printf '%0.s─' {1..110}; echo

# ── Gather node allocatable resources ───────────────────────────────────
NODE_CAP=$(kubectl get nodes -o json | jq -r '
  .items[] | [
    .metadata.name,
    (.status.allocatable.cpu     // "0"),
    (.status.allocatable.memory  // "0")
  ] | @tsv
')

# ── Gather all pod resource requests across nodes ───────────────────────
{
  echo "$NODE_CAP" | while IFS=$'\t' read -r name cpu mem; do
    printf "NODE_CAP\t%s\t%s\t%s\n" "$name" "$cpu" "$mem"
  done
  kubectl get pods --all-namespaces -o json | \
  jq -r '
    .items[]
    | select(.status.phase != "Succeeded" and .status.phase != "Failed")
    | select(.spec.nodeName != null)
    | .spec.nodeName as $node
    | .metadata.namespace as $ns
    | .spec.containers[]
    | {
        node: $node,
        ns: $ns,
        cpu_req:  (.resources.requests.cpu     // "0"),
        cpu_lim:  (.resources.limits.cpu       // "0"),
        mem_req:  (.resources.requests.memory  // "0"),
        mem_lim:  (.resources.limits.memory    // "0")
      }
    | [.node, .ns, .cpu_req, .cpu_lim, .mem_req, .mem_lim]
    | @tsv
  ' | sort -k1,1 -k2,2
} | awk -v node_filter="$NODE_FILTER" '
# ── Helper functions to normalise CPU → millicores, memory → MiB ──
function cpu_to_milli(v) {
  if (v ~ /m$/) { gsub(/m$/, "", v); return int(v) }
  return int(v * 1000)
}
function mem_to_mi(v) {
  if (v ~ /Gi$/) { gsub(/Gi$/, "", v); return int(v * 1024) }
  if (v ~ /G$/)  { gsub(/G$/,  "", v); return int(v * 1000) }
  if (v ~ /Mi$/) { gsub(/Mi$/, "", v); return int(v) }
  if (v ~ /M$/)  { gsub(/M$/,  "", v); return int(v) }
  if (v ~ /Ki$/) { gsub(/Ki$/, "", v); return int(v / 1024) }
  if (v ~ /K$/)  { gsub(/K$/,  "", v); return int(v / 1000) }
  if (v ~ /Ti$/) { gsub(/Ti$/, "", v); return int(v * 1048576) }
  if (v ~ /T$/)  { gsub(/T$/,  "", v); return int(v * 1000000) }
  # plain bytes
  return int(v / 1048576)
}

{
  if ($1 == "NODE_CAP") {
    nd = $2
    if (node_filter != "" && nd != node_filter) next
    node_alloc_cpu[nd] = cpu_to_milli($3)
    node_alloc_mem[nd] = mem_to_mi($4)
    next
  }

  node = $1; ns = $2
  if (node_filter != "" && node != node_filter) next

  key = node SUBSEP ns
  cpu_req[key] += cpu_to_milli($3)
  cpu_lim[key] += cpu_to_milli($4)
  mem_req[key] += mem_to_mi($5)
  mem_lim[key] += mem_to_mi($6)

  if (!(node in node_count)) { node_order[++nc] = node; node_count[node] = 0 }
  if (!(key in seen)) { seen[key] = 1; ns_order[node, ++node_count[node]] = ns }
}

END {
  for (i = 1; i <= nc; i++) {
    node = node_order[i]
    node_cpu_req = 0; node_cpu_lim = 0; node_mem_req = 0; node_mem_lim = 0
    for (j = 1; j <= node_count[node]; j++) {
      ns = ns_order[node, j]
      key = node SUBSEP ns
      printf "%-42s %-20s %10d %10d %12d %12d\n", \
        (j == 1 ? node : ""), ns, \
        cpu_req[key], cpu_lim[key], \
        mem_req[key], mem_lim[key]
      node_cpu_req += cpu_req[key]
      node_cpu_lim += cpu_lim[key]
      node_mem_req += mem_req[key]
      node_mem_lim += mem_lim[key]
    }
    # Node totals
    printf "%-42s %-20s %10d %10d %12d %12d\n", \
      "", "** TOTAL **", node_cpu_req, node_cpu_lim, node_mem_req, node_mem_lim
    # Node capacity & percentage
    acpu = node_alloc_cpu[node]; amem = node_alloc_mem[node]
    cpu_pct = (acpu > 0) ? (node_cpu_req / acpu * 100) : 0
    mem_pct = (amem > 0) ? (node_mem_req / amem * 100) : 0
    printf "%-42s %-20s %10d %10s %12d %12s\n", \
      "", "  Allocatable", acpu, "", amem, ""
    printf "%-42s %-20s %7d (%2.0f%%) %10s %9d (%2.0f%%) %9s\n", \
      "", "  Reserved", node_cpu_req, cpu_pct, "", node_mem_req, mem_pct, ""
    # separator between nodes
    for (s = 0; s < 110; s++) printf "─"
    printf "\n"
  }
}
'
