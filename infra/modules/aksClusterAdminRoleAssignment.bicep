targetScope = 'resourceGroup'

@description('AKS cluster name to apply the role assignment to.')
param clusterName string

@description('Principal object ID that should receive the role assignment.')
param principalId string

@description('Role definition resource ID to assign.')
param roleDefinitionId string

@description('Optional deterministic seed for the role assignment GUID name.')
param assignmentGuidSeed string = principalId

resource cluster 'Microsoft.ContainerService/managedClusters@2024-05-02-preview' existing = {
  name: clusterName
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(cluster.id, assignmentGuidSeed, roleDefinitionId)
  scope: cluster
  properties: {
    principalId: principalId
    roleDefinitionId: roleDefinitionId
  }
}
