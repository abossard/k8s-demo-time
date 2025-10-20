# Plan: Configurable Headless Service Names

## Objective
Make headless service names configurable via environment variables across all Kubernetes manifests.

## Tasks

### 1. Update Configuration System
- [x] Verify current appsettings.json has ServiceName configuration
- [ ] Update appsettings.json to support env var fallback pattern
- [ ] Verify PodCoordinator.cs properly reads from IConfiguration

### 2. Add Environment Variables to Deployments
- [x] Add SERVICE_NAME env var to all app deployments
- [x] Ensure consistency with headless service names

### 3. Add Missing Headless Services
- [x] Review which manifests need headless services
- [x] Add headless services where missing
- [x] Ensure naming consistency

### 4. Files to Update

#### Base Workloads (already have headless services)
- [x] k8s/hpa/step-01-base-workload.yaml - Added SERVICE_NAME env var
- [x] k8s/vpa/step-01-base-workload.yaml - Added SERVICE_NAME env var  
- [x] k8s/qos/step-01-guaranteed-qos.yaml - Added SERVICE_NAME and POD_NAMESPACE env vars
- [x] k8s/combined/step-01-hpa-with-guaranteed-qos.yaml - Added SERVICE_NAME and POD_NAMESPACE env vars
- [x] k8s/deployment.yaml - Added SERVICE_NAME env var

#### Need Headless Services Added
- [x] k8s/combined/step-02-vpa-with-burstable-qos.yaml - Added backend-burstable-headless
- [x] k8s/combined/step-03-complete-demo.yaml - Added 3 headless services
- [x] k8s/qos/step-02-burstable-qos.yaml - Added burstable-qos-headless  
- [x] k8s/qos/step-03-besteffort-qos.yaml - Added besteffort-qos-headless
- [x] k8s/qos/step-04-mixed-qos-eviction-demo.yaml - Added 3 headless services
- [x] k8s/qos/step-05-priority-classes.yaml - Added 2 headless services

#### VPA Steps (reference base workload)
- [x] Reference step-01-base-workload.yaml via VPA resources

## Implementation Details

### Environment Variable Pattern
```yaml
env:
- name: SERVICE_NAME
  value: "k8s-demo-app-headless"
```

### Headless Service Pattern
```yaml
apiVersion: v1
kind: Service
metadata:
  name: k8s-demo-app-headless
  namespace: [appropriate-namespace]
spec:
  clusterIP: None
  selector:
    app: k8s-demo-app
  ports:
  - port: 80
    targetPort: 8080
```

### Configuration Pattern
```json
{
  "ServiceName": "k8s-demo-app-headless"
}
```

## Validation
- [x] All deployments with app containers have SERVICE_NAME env var
- [x] All namespaces with deployments have corresponding headless services
- [x] Service names match between env vars and service definitions
- [x] PodCoordinator can discover pods via configurable service name