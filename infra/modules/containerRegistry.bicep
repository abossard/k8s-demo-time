targetScope = 'resourceGroup'

@description('Name of the Azure Container Registry to create.')
param registryName string

@description('Azure region where the registry will be deployed.')
param registryLocation string

@description('SKU tier for the container registry.')
@allowed([
  'Basic'
  'Standard'
  'Premium'
])
param registrySku string

@description('Enable the built-in admin user for the registry.')
param adminUserEnabled bool

@description('Enable anonymous pull access for public image hosting.')
param anonymousPullEnabled bool

@description('Configure public network reachability.')
@allowed([
  'Enabled'
  'Disabled'
])
param publicNetworkAccess string

@description('Enable the data endpoint for the registry.')
param dataEndpointEnabled bool

@description('Tags to apply to the registry resource.')
param tags object

resource registry 'Microsoft.ContainerRegistry/registries@2023-06-01-preview' = {
  name: registryName
  location: registryLocation
  sku: {
    name: registrySku
  }
  tags: tags
  properties: {
    adminUserEnabled: adminUserEnabled
    anonymousPullEnabled: anonymousPullEnabled
    dataEndpointEnabled: dataEndpointEnabled
    publicNetworkAccess: publicNetworkAccess
  }
}

output registryResourceId string = registry.id
output registryLoginServer string = registry.properties.loginServer
