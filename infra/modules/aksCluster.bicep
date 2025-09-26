targetScope = 'resourceGroup'

@description('Name of the AKS cluster to create.')
param clusterName string

@description('Azure region for the AKS cluster and supporting resources.')
param location string

@description('DNS prefix for the managed Kubernetes API server.')
param dnsPrefix string

@description('Optional Kubernetes version to deploy. Provide an empty string to use the regional default.')
param kubernetesVersion string = ''

@description('Upgrade channel controlling automatic cluster and node updates.')
@allowed([
  'rapid'
  'stable'
  'patch'
  'node-image'
  'none'
])
param upgradeChannel string

@description('Node OS image upgrade channel controlling automatic node image rollouts.')
@allowed([
  'NodeImage'
  'None'
])
param nodeOsUpgradeChannel string

@description('Virtual machine size for the system node pool.')
param systemNodeVmSize string

@description('Minimum number of nodes in the system node pool.')
param systemNodeMinCount int

@description('Maximum number of nodes in the system node pool.')
param systemNodeMaxCount int

@description('Enable Azure RBAC for Kubernetes authorization.')
param enableAzureRBAC bool

@description('Object IDs of Entra ID groups granted cluster admin rights.')
param adminGroupObjectIds array

@description('Enable node auto provisioning (Karpenter).')
param enableNodeAutoProvisioning bool

@description('Pod address spaces used by the Azure CNI overlay.')
param podCidrs array

@description('Service CIDR ranges for cluster services.')
param serviceCidrs array

@description('DNS service IP address for the cluster.')
param dnsServiceIp string

@description('Enable KEDA workload autoscaler for the cluster.')
param enableKeda bool

@description('Enable Azure Monitor managed Prometheus metrics collection.')
param enableAzureMonitorMetrics bool

@description('Tenant ID used for Entra ID integration.')
param aadTenantId string

@description('Tags to apply to all resources created by this module.')
param tags object

var nodeProvisioningProfile = {
  mode: enableNodeAutoProvisioning ? 'Auto' : 'Manual'
}

var versionProfile = empty(kubernetesVersion) ? {} : {
  kubernetesVersion: kubernetesVersion
}

var azureMonitorProfile = enableAzureMonitorMetrics ? {
  azureMonitorProfile: {
    metrics: {
      enabled: true
    }
  }
} : {}

resource managedCluster 'Microsoft.ContainerService/managedClusters@2024-05-02-preview' = {
  name: clusterName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: union({
      dnsPrefix: dnsPrefix
      enableRBAC: enableAzureRBAC
      aadProfile: {
        managed: true
        enableAzureRBAC: enableAzureRBAC
        tenantId: aadTenantId
        adminGroupObjectIDs: adminGroupObjectIds
      }
      autoUpgradeProfile: {
        upgradeChannel: upgradeChannel
        nodeOSUpgradeChannel: nodeOsUpgradeChannel
      }
      disableLocalAccounts: true
      nodeProvisioningProfile: nodeProvisioningProfile
      workloadAutoScalerProfile: {
        keda: {
          enabled: enableKeda
        }
      }
      addonProfiles: {
      }
      networkProfile: {
        networkPlugin: 'azure'
        networkPluginMode: 'overlay'
        networkDataplane: 'cilium'
        loadBalancerSku: 'standard'
        outboundType: 'loadBalancer'
        podCidrs: podCidrs
        serviceCidrs: serviceCidrs
        dnsServiceIP: dnsServiceIp
      }
      agentPoolProfiles: [
        {
          name: 'systempool'
          mode: 'System'
          type: 'VirtualMachineScaleSets'
          osType: 'Linux'
          osSKU: 'Ubuntu'
          vmSize: systemNodeVmSize
          minCount: systemNodeMinCount
          maxCount: systemNodeMaxCount
          count: systemNodeMinCount
          enableAutoScaling: true
          enableEncryptionAtHost: false
          enableNodePublicIP: false
          kubeletDiskType: 'OS'
          maxPods: 110
          nodeTaints: [
            'CriticalAddonsOnly=true:NoSchedule'
          ]
        }
      ]
    },
    versionProfile,
    azureMonitorProfile)
}

output clusterResourceId string = managedCluster.id
output kubeletIdentityResourceId string = managedCluster.properties.identityProfile.kubeletidentity.resourceId
output kubeletPrincipalId string = managedCluster.properties.identityProfile.kubeletidentity.objectId
