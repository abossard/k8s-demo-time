param managedClusters_k8s_demo_cluster_1_name string = 'k8s-demo-cluster-1'
param userAssignedIdentities_k8s_demo_cluster_1_agentpool_externalid string = '/subscriptions/b2af20ad-98fa-4aa7-94c3-059663641d9f/resourceGroups/MC_anbo-k8s-demo_k8s-demo-cluster-1_swedencentral/providers/Microsoft.ManagedIdentity/userAssignedIdentities/k8s-demo-cluster-1-agentpool'

resource managedClusters_k8s_demo_cluster_1_name_resource 'Microsoft.ContainerService/managedClusters@2025-05-01' = {
  name: managedClusters_k8s_demo_cluster_1_name
  location: 'swedencentral'
  sku: {
    name: 'Base'
    tier: 'Free'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    kubernetesVersion: '1.32'
    dnsPrefix: 'k8s-demo-c-anbo-k8s-demo-b2af20'
    agentPoolProfiles: [
      {
        name: 'nodepool1'
        count: 3
        vmSize: 'Standard_D8ds_v4'
        osDiskSizeGB: 200
        osDiskType: 'Ephemeral'
        kubeletDiskType: 'OS'
        workloadRuntime: 'OCIContainer'
        maxPods: 250
        type: 'VirtualMachineScaleSets'
        enableAutoScaling: false
        scaleDownMode: 'Delete'
        powerState: {
          code: 'Running'
        }
        orchestratorVersion: '1.32'
        enableNodePublicIP: false
        mode: 'System'
        enableEncryptionAtHost: false
        enableUltraSSD: false
        osType: 'Linux'
        osSKU: 'Ubuntu'
        upgradeSettings: {
          maxSurge: '10%'
          maxUnavailable: '0'
        }
        enableFIPS: false
        networkProfile: {}
        securityProfile: {
          enableVTPM: false
          enableSecureBoot: false
        }
      }
    ]
    linuxProfile: {
      adminUsername: 'azureuser'
      ssh: {
        publicKeys: [
          {
            keyData: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDIi1ho9XopM/W1gRqRlu9UBBL35H0+C1agFABShM4KbH52UXvt1YCMlMq32rqsIGqIDJDGSct1JZo/YaGIgQc2iqMe1spxdKWi/n/av0EoVTFrK37B+4Hqwke2X3LYELmdEMnzLYpVQwFWWEGv/VY2sbC7KyMotJEBrh1zQ2y6NtHqrLiHZ4Pjtm9if+vXeJbk5MHXiH6OeMY/tN8D1pgyS0XoVxEuAGFY4q4riaqVUcIhjfNQdSvRAWV6fQ59K/wMCziC3xjhUxWLlhDqtzgzlI0uGsENJ+3GQUpX7HY/0/O6T9Uj7o3qBq+JzBZ4mwyPSqkwavdhWGzbdz2hyzfP'
          }
        ]
      }
    }
    servicePrincipalProfile: {
      clientId: 'msi'
    }
    nodeResourceGroup: 'MC_anbo-k8s-demo_${managedClusters_k8s_demo_cluster_1_name}_swedencentral'
    enableRBAC: true
    supportPlan: 'KubernetesOfficial'
    networkProfile: {
      networkPlugin: 'azure'
      networkPluginMode: 'overlay'
      networkPolicy: 'none'
      networkDataplane: 'azure'
      loadBalancerSku: 'standard'
      loadBalancerProfile: {
        managedOutboundIPs: {
          count: 1
        }
        backendPoolType: 'nodeIPConfiguration'
      }
      podCidr: '10.244.0.0/16'
      serviceCidr: '10.0.0.0/16'
      dnsServiceIP: '10.0.0.10'
      outboundType: 'loadBalancer'
      podCidrs: [
        '10.244.0.0/16'
      ]
      serviceCidrs: [
        '10.0.0.0/16'
      ]
      ipFamilies: [
        'IPv4'
      ]
    }
    identityProfile: {
      kubeletidentity: {
        resourceId: userAssignedIdentities_k8s_demo_cluster_1_agentpool_externalid
        clientId: '737ea439-d6c4-4813-af30-0e172098ee70'
        objectId: '62c30155-fd40-4413-a727-f63599699c8e'
      }
    }
    autoUpgradeProfile: {
      nodeOSUpgradeChannel: 'NodeImage'
    }
    disableLocalAccounts: false
    securityProfile: {}
    storageProfile: {
      diskCSIDriver: {
        enabled: true
      }
      fileCSIDriver: {
        enabled: true
      }
      snapshotController: {
        enabled: true
      }
    }
    oidcIssuerProfile: {
      enabled: false
    }
    workloadAutoScalerProfile: {}
    metricsProfile: {
      costAnalysis: {
        enabled: false
      }
    }
    nodeProvisioningProfile: {
      mode: 'Manual'
      defaultNodePools: 'Auto'
    }
    bootstrapProfile: {
      artifactSource: 'Direct'
    }
  }
}

resource managedClusters_k8s_demo_cluster_1_name_nodepool1 'Microsoft.ContainerService/managedClusters/agentPools@2025-05-01' = {
  parent: managedClusters_k8s_demo_cluster_1_name_resource
  name: 'nodepool1'
  properties: {
    count: 1
    vmSize: 'Standard_D8ds_v4'
    osDiskSizeGB: 200
    osDiskType: 'Ephemeral'
    kubeletDiskType: 'OS'
    workloadRuntime: 'OCIContainer'
    maxPods: 250
    type: 'VirtualMachineScaleSets'
    enableAutoScaling: false
    scaleDownMode: 'Delete'
    powerState: {
      code: 'Running'
    }
    orchestratorVersion: '1.32'
    enableNodePublicIP: false
    mode: 'System'
    enableEncryptionAtHost: false
    enableUltraSSD: false
    osType: 'Linux'
    osSKU: 'Ubuntu'
    upgradeSettings: {
      maxSurge: '10%'
      maxUnavailable: '0'
    }
    enableFIPS: false
    networkProfile: {}
    securityProfile: {
      enableVTPM: false
      enableSecureBoot: false
    }
  }
}

resource managedClusters_k8s_demo_cluster_1_name_nodepool1_aks_nodepool1_29942824_vmss000000 'Microsoft.ContainerService/managedClusters/agentPools/machines@2025-04-02-preview' = {
  parent: managedClusters_k8s_demo_cluster_1_name_nodepool1
  name: 'aks-nodepool1-29942824-vmss000000'
  properties: {
    network: {}
  }
  dependsOn: [
    managedClusters_k8s_demo_cluster_1_name_resource
  ]
}

resource managedClusters_k8s_demo_cluster_1_name_nodepool1_aks_nodepool1_29942824_vmss000001 'Microsoft.ContainerService/managedClusters/agentPools/machines@2025-04-02-preview' = {
  parent: managedClusters_k8s_demo_cluster_1_name_nodepool1
  name: 'aks-nodepool1-29942824-vmss000001'
  properties: {
    network: {}
  }
  dependsOn: [
    managedClusters_k8s_demo_cluster_1_name_resource
  ]
}

resource managedClusters_k8s_demo_cluster_1_name_nodepool1_aks_nodepool1_29942824_vmss000002 'Microsoft.ContainerService/managedClusters/agentPools/machines@2025-04-02-preview' = {
  parent: managedClusters_k8s_demo_cluster_1_name_nodepool1
  name: 'aks-nodepool1-29942824-vmss000002'
  properties: {
    network: {}
  }
  dependsOn: [
    managedClusters_k8s_demo_cluster_1_name_resource
  ]
}
