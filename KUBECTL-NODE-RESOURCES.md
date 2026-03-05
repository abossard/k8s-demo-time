# kubectl Node Resource Cheatsheet

Quick commands to inspect CPU/memory reservations per node and namespace.

## Full Report (script)

```bash
# All nodes – CPU & memory requests/limits broken down by namespace
./kubectl-node-resources.sh

# Single node
./kubectl-node-resources.sh aks-nodepool1-12345678-vmss000000
```

## One-Liners

### Requests per node (summary)

```bash
kubectl describe nodes | grep -A5 "Allocated resources"
```

### Requests per node, per namespace (compact)

```bash
kubectl get pods -A -o json | jq -r '
  .items[]
  | select(.status.phase == "Running")
  | [.spec.nodeName, .metadata.namespace,
     (.spec.containers | map(.resources.requests.cpu     // "0") | join("+")),
     (.spec.containers | map(.resources.requests.memory  // "0") | join("+"))]
  | @tsv' | sort | column -t
```

### Top pods by CPU request on a specific node

```bash
NODE="<node-name>"
kubectl get pods -A --field-selector spec.nodeName=$NODE -o json | jq -r '
  .items[] | select(.status.phase=="Running")
  | .metadata as $m
  | .spec.containers[]
  | [$m.namespace, $m.name, (.resources.requests.cpu // "0"), (.resources.requests.memory // "0")]
  | @tsv' | sort -k3 -rn | column -t
```

### Node allocatable vs. requested (quick %)

```bash
kubectl top nodes
```

### Which namespaces consume the most across the cluster?

```bash
kubectl get pods -A -o json | jq -r '
  [.items[]
   | select(.status.phase == "Running")
   | .metadata.namespace as $ns
   | .spec.containers[]
   | {ns: $ns,
      cpu: (if .resources.requests.cpu then
              (if (.resources.requests.cpu | test("m$"))
               then (.resources.requests.cpu | rtrimstr("m") | tonumber)
               else (.resources.requests.cpu | tonumber * 1000) end)
            else 0 end),
      mem: (if .resources.requests.memory then
              (if (.resources.requests.memory | test("Mi$"))
               then (.resources.requests.memory | rtrimstr("Mi") | tonumber)
               elif (.resources.requests.memory | test("Gi$"))
               then (.resources.requests.memory | rtrimstr("Gi") | tonumber * 1024)
               else 0 end)
            else 0 end)}]
  | group_by(.ns)
  | map({ns: .[0].ns, cpu_m: (map(.cpu)|add), mem_Mi: (map(.mem)|add)})
  | sort_by(-.cpu_m)[]
  | [.ns, "\(.cpu_m)m", "\(.mem_Mi)Mi"]
  | @tsv' | column -t
```

### Pods without any resource requests (potential risk)

```bash
kubectl get pods -A -o json | jq -r '
  .items[]
  | select(.status.phase == "Running")
  | select(.spec.containers | any(.resources.requests == null or .resources.requests == {}))
  | [.metadata.namespace, .metadata.name]
  | @tsv' | column -t
```

## Notes

- **Requests** = guaranteed reservation the scheduler uses for placement.
- **Limits** = max the container may use before throttling (CPU) or OOM-kill (memory).
- Pods in `Succeeded`/`Failed` phase are excluded (they don't consume resources).
- `kubectl top nodes` shows *actual* usage; the script shows *reserved* (requested) resources.
