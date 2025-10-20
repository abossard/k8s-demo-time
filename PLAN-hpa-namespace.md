# Plan: Isolate HPA Demo Namespace

- Select a consistent namespace name (e.g., `hpa-demo`) for all lab manifests.
- Update `step-01-base-workload.yaml` to create the namespace resource and scope the Deployment and Service to it.
- Amend subsequent HPA manifests (`step-02` through `step-05`) so their metadata and `scaleTargetRef` point to the namespace.
- Ensure the cleanup manifest removes resources within the namespace and deletes the namespace itself.