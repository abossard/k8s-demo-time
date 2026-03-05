package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

type nsResources struct {
	cpuReq int64
	cpuLim int64
	memReq int64
	memLim int64
}

type nodeInfo struct {
	allocCPU int64 // millicores
	allocMem int64 // MiB
	nss      map[string]*nsResources
}

func main() {
	nodeFilter := ""
	if len(os.Args) > 1 {
		nodeFilter = os.Args[1]
	}

	client := buildClient()
	ctx := context.Background()

	// Gather node allocatable
	nodes := gatherNodes(ctx, client, nodeFilter)

	// Gather pod resources
	gatherPods(ctx, client, nodes, nodeFilter)

	// Print
	printTable(nodes)
}

func buildClient() *kubernetes.Clientset {
	rules := clientcmd.NewDefaultClientConfigLoadingRules()
	if env := os.Getenv("KUBECONFIG"); env != "" {
		rules.ExplicitPath = env
	} else if home, err := os.UserHomeDir(); err == nil {
		rules.ExplicitPath = filepath.Join(home, ".kube", "config")
	}
	config, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(rules, nil).ClientConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading kubeconfig: %v\n", err)
		os.Exit(1)
	}
	cs, err := kubernetes.NewForConfig(config)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error creating client: %v\n", err)
		os.Exit(1)
	}
	return cs
}

func toMilli(q resource.Quantity) int64 {
	return q.MilliValue()
}

func toMiB(q resource.Quantity) int64 {
	return q.Value() / (1024 * 1024)
}

func gatherNodes(ctx context.Context, cs *kubernetes.Clientset, filter string) map[string]*nodeInfo {
	nodeList, err := cs.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error listing nodes: %v\n", err)
		os.Exit(1)
	}
	nodes := make(map[string]*nodeInfo)
	for _, n := range nodeList.Items {
		name := n.Name
		if filter != "" && name != filter {
			continue
		}
		alloc := n.Status.Allocatable
		nodes[name] = &nodeInfo{
			allocCPU: toMilli(*alloc.Cpu()),
			allocMem: toMiB(*alloc.Memory()),
			nss:      make(map[string]*nsResources),
		}
	}
	return nodes
}

func gatherPods(ctx context.Context, cs *kubernetes.Clientset, nodes map[string]*nodeInfo, filter string) {
	podList, err := cs.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error listing pods: %v\n", err)
		os.Exit(1)
	}
	for _, p := range podList.Items {
		if p.Status.Phase == corev1.PodSucceeded || p.Status.Phase == corev1.PodFailed {
			continue
		}
		nodeName := p.Spec.NodeName
		if nodeName == "" {
			continue
		}
		if filter != "" && nodeName != filter {
			continue
		}
		ni, ok := nodes[nodeName]
		if !ok {
			continue
		}
		ns := p.Namespace
		nr, ok := ni.nss[ns]
		if !ok {
			nr = &nsResources{}
			ni.nss[ns] = nr
		}
		for _, c := range p.Spec.Containers {
			req := c.Resources.Requests
			lim := c.Resources.Limits
			if q, ok := req[corev1.ResourceCPU]; ok {
				nr.cpuReq += toMilli(q)
			}
			if q, ok := lim[corev1.ResourceCPU]; ok {
				nr.cpuLim += toMilli(q)
			}
			if q, ok := req[corev1.ResourceMemory]; ok {
				nr.memReq += toMiB(q)
			}
			if q, ok := lim[corev1.ResourceMemory]; ok {
				nr.memLim += toMiB(q)
			}
		}
	}
}

func printTable(nodes map[string]*nodeInfo) {
	fmt.Printf("%-42s %-20s %10s %10s %12s %12s\n",
		"NODE", "NAMESPACE", "CPU_REQ(m)", "CPU_LIM(m)", "MEM_REQ(Mi)", "MEM_LIM(Mi)")
	fmt.Println(strings.Repeat("─", 110))

	sortedNodes := make([]string, 0, len(nodes))
	for n := range nodes {
		sortedNodes = append(sortedNodes, n)
	}
	sort.Strings(sortedNodes)

	for _, node := range sortedNodes {
		ni := nodes[node]
		nsList := make([]string, 0, len(ni.nss))
		for ns := range ni.nss {
			nsList = append(nsList, ns)
		}
		sort.Strings(nsList)

		var totalCPUReq, totalCPULim, totalMemReq, totalMemLim int64
		for j, ns := range nsList {
			nr := ni.nss[ns]
			label := ""
			if j == 0 {
				label = node
			}
			fmt.Printf("%-42s %-20s %10d %10d %12d %12d\n",
				label, ns, nr.cpuReq, nr.cpuLim, nr.memReq, nr.memLim)
			totalCPUReq += nr.cpuReq
			totalCPULim += nr.cpuLim
			totalMemReq += nr.memReq
			totalMemLim += nr.memLim
		}

		// TOTAL
		fmt.Printf("%-42s %-20s %10d %10d %12d %12d\n",
			"", "** TOTAL **", totalCPUReq, totalCPULim, totalMemReq, totalMemLim)

		// Allocatable
		fmt.Printf("%-42s %-20s %10d %10s %12d %12s\n",
			"", "  Allocatable", ni.allocCPU, "", ni.allocMem, "")

		// Reserved with percentage
		cpuPct := float64(0)
		if ni.allocCPU > 0 {
			cpuPct = float64(totalCPUReq) / float64(ni.allocCPU) * 100
		}
		memPct := float64(0)
		if ni.allocMem > 0 {
			memPct = float64(totalMemReq) / float64(ni.allocMem) * 100
		}
		fmt.Printf("%-42s %-20s %7d (%2.0f%%) %10s %9d (%2.0f%%) %9s\n",
			"", "  Reserved", totalCPUReq, cpuPct, "", totalMemReq, memPct, "")

		fmt.Println(strings.Repeat("─", 110))
	}
}
