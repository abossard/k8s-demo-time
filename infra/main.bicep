targetScope = 'subscription'

@description('Name of the resource group to create.')
param resourceGroupName string

@description('Azure region for the resource group and registry.')
param location string = deployment().location

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

resource managedResourceGroup 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: resourceGroupName
  location: location
  tags: commonTags
}

module containerRegistry 'modules/containerRegistry.bicep' = {
  name: 'acrDeployment'
  scope: managedResourceGroup
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

output resourceGroupId string = managedResourceGroup.id
output registryResourceId string = containerRegistry.outputs.registryResourceId
output registryLoginServer string = containerRegistry.outputs.registryLoginServer
