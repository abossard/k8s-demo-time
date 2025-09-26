targetScope = 'subscription'

@description('Name of the resource group that will host the registry, AKS cluster, and related resources.')
param resourceGroupName string

@description('Azure region for the container registry resource group and registry. Defaults to Sweden Central.')
param location string = 'swedencentral'

@description('Name of the Azure Container Registry. Must be globally unique and use only lowercase alphanumeric characters.')
@minLength(5)
@maxLength(50)
param registryName string

@description('SKU tier for the container registry.')
@allowed([
  'Basic'
  'Standard'
  'Premium'
])
param registrySku string = 'Standard'

@description('Enable the built-in admin user for the registry. Disabled by default for security.')
param adminUserEnabled bool = false

@description('Enable anonymous pull access so the registry can serve public images.')
param anonymousPullEnabled bool = true

@description('Configure the registry public network accessibility.')
@allowed([
  'Enabled'
  'Disabled'
])
param publicNetworkAccess string = 'Enabled'

@description('Enable the data endpoint for the registry to support dedicated data-plane operations.')
param dataEndpointEnabled bool = false

@description('Optional set of tags to apply to created resources.')
param commonTags object = {}

@description('Region to deploy the container registry. Defaults to the resource group location.')
param registryLocation string = location

@description('Name of the AKS cluster.')
param aksClusterName string

@description('DNS prefix for the AKS API server endpoint.')
param aksDnsPrefix string

@description('Object IDs of Entra ID groups granted cluster admin rights.')
param adminGroupObjectIds array = []

@description('Optional Kubernetes version to deploy. Leave blank to use the default version for the region.')
param kubernetesVersion string = ''

@description('Upgrade channel controlling automatic control-plane and node updates.')
@allowed([
  'rapid'
  'stable'
  'patch'
  'node-image'
  'none'
])
param upgradeChannel string = 'stable'

@description('Node OS image upgrade channel controlling automatic node image updates.')
@allowed([
  'NodeImage'
  'None'
])
param nodeOsUpgradeChannel string = 'NodeImage'

@description('Virtual machine size for the system node pool.')
param systemNodeVmSize string = 'Standard_B2s'

@description('Minimum number of nodes in the system node pool when autoscaling.')
param systemNodeMinCount int = 1

@description('Maximum number of nodes in the system node pool when autoscaling.')
param systemNodeMaxCount int = 3

@description('Enable node auto provisioning for the cluster (preview Karpenter integration).')
param enableNodeAutoProvisioning bool = true

@description('Pod address spaces used by the Azure CNI overlay (Cilium).')
param podCidrs array = [
  '10.244.0.0/16'
]

@description('Service CIDR ranges for cluster Kubernetes services.')
param serviceCidrs array = [
  '10.0.0.0/16'
]

@description('DNS service IP address within the service CIDR.')
param dnsServiceIp string = '10.0.0.10'

@description('Enable KEDA for workload autoscaling.')
param enableKeda bool = true

@description('Enable the managed Vertical Pod Autoscaler add-on (preview).')
param enableVerticalPodAutoscaler bool = false

@description('Enable Azure Monitor managed Prometheus integration.')
param enableAzureMonitorMetrics bool = true

@description('Enable Azure RBAC for Kubernetes authorization.')
param enableAzureRBAC bool = true

@description('Tenant ID used for Entra ID integration. Defaults to the current deployment tenant.')
param aadTenantId string = tenant().tenantId

@description('Object ID for the principal that should receive the built-in AKS Cluster Admin role. Leave blank to skip the assignment.')
param clusterAdminPrincipalId string = ''

resource deploymentResourceGroup 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: resourceGroupName
  location: location
  tags: commonTags
}

module containerRegistry 'modules/containerRegistry.bicep' = {
  name: 'acrDeployment'
  scope: deploymentResourceGroup
  params: {
    registryName: registryName
    registryLocation: registryLocation
    registrySku: registrySku
    adminUserEnabled: adminUserEnabled
    anonymousPullEnabled: anonymousPullEnabled
    publicNetworkAccess: publicNetworkAccess
    dataEndpointEnabled: dataEndpointEnabled
    tags: commonTags
  }
}

module aksCluster 'modules/aksCluster.bicep' = {
  name: 'aksDeployment'
  scope: deploymentResourceGroup
  params: {
    clusterName: aksClusterName
    location: location
    dnsPrefix: aksDnsPrefix
    kubernetesVersion: kubernetesVersion
    upgradeChannel: upgradeChannel
    nodeOsUpgradeChannel: nodeOsUpgradeChannel
    systemNodeVmSize: systemNodeVmSize
    systemNodeMinCount: systemNodeMinCount
    enableAzureRBAC: enableAzureRBAC
    adminGroupObjectIds: adminGroupObjectIds
    enableNodeAutoProvisioning: enableNodeAutoProvisioning
    podCidrs: podCidrs
    serviceCidrs: serviceCidrs
    dnsServiceIp: dnsServiceIp
    enableKeda: enableKeda
    enableVerticalPodAutoscaler: enableVerticalPodAutoscaler
    enableAzureMonitorMetrics: enableAzureMonitorMetrics
    aadTenantId: aadTenantId
    tags: commonTags
  }
}

var acrPullRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
var aksClusterAdminRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b1ff04bb-8a4e-4dc4-8eb5-8693973ce19b')

module kubeletAcrPull 'modules/acrRoleAssignment.bicep' = {
  name: 'acrPullAssignment'
  scope: deploymentResourceGroup
  dependsOn: [
    containerRegistry
  ]
  params: {
    registryName: registryName
    principalId: aksCluster.outputs.kubeletPrincipalId
    roleDefinitionId: acrPullRoleDefinitionId
    assignmentGuidSeed: aksClusterName
  }
}

module clusterAdminRoleAssignment 'modules/aksClusterAdminRoleAssignment.bicep' = if (!empty(clusterAdminPrincipalId)) {
  name: 'aksClusterAdminRoleAssignment'
  scope: deploymentResourceGroup
  dependsOn: [
    aksCluster
  ]
  params: {
    clusterName: aksClusterName
    principalId: clusterAdminPrincipalId
    roleDefinitionId: aksClusterAdminRoleDefinitionId
    assignmentGuidSeed: clusterAdminPrincipalId
  }
}

output resourceGroupId string = deploymentResourceGroup.id
output registryResourceId string = containerRegistry.outputs.registryResourceId
output registryLoginServer string = containerRegistry.outputs.registryLoginServer
output aksResourceGroupId string = deploymentResourceGroup.id
output aksClusterResourceId string = aksCluster.outputs.clusterResourceId
output kubeletIdentityResourceId string = aksCluster.outputs.kubeletIdentityResourceId
