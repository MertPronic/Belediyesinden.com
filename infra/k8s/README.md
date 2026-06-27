# Belediyesinden · K8s Deployment

Production deployment manifests (Faz 6 / İP8).

## Yaml dosyaları

- `api-deployment.yaml` — API Deployment (2 replicas) + ClusterIP Service.
  - Readiness probe: `/api/health`
  - Resource limits: 512Mi / 500m
  - Env: postgres, keycloak, opensearch, minio (K8s service names)

## Deployment

```bash
# Docker image build + push
docker build -f apps/api/Dockerfile -t registry.example.com/belediyesinden/api:latest .
docker push registry.example.com/belediyesinden/api:latest

# K8s apply
kubectl apply -f infra/k8s/api-deployment.yaml

# Verify
kubectl get pods -l app=belediyesinden-api
kubectl scale deployment belediyesinden-api --replicas=3  # auto-scale
```

## Yapılmadılar (ileriki adımlar)

- Helm chart (values.yaml ile parametrik).
- Ingress (Nginx) — subdomain → tenant routing.
- HPA (Horizontal Pod Autoscaler) — CPU/load bazlı otomatik ölçeklenme.
- Prometheus/Grafana monitoring (observability).
- Backup/DR — schema-per-tenant dump/restore (CronJob).
- Secret management (Keycloak secrets, DB passwords).
