targetScope = 'resourceGroup'

@description('Name of the Azure Container Registry to assign permissions to.')
param registryName string

@description('Principal ID to grant permissions (e.g., the kubelet managed identity).')
param principalId string

@description('Role definition resource ID for the assignment.')
param roleDefinitionId string

@description('Deterministic seed used to build the role assignment name.')
param assignmentGuidSeed string

resource registry 'Microsoft.ContainerRegistry/registries@2023-06-01-preview' existing = {
  name: registryName
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, assignmentGuidSeed, roleDefinitionId)
  scope: registry
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: roleDefinitionId
  }
}
