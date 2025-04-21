# Finalizing the cluster setup

Do this once you are done with the basic cluster creation on either Hetzner or Digital Ocean.

## Setup constants

Updade the file `.devops/config/constants.yaml` that was created after running `bunx devops init`.

## Install the metrics server

Install the metrics server (based on the [instructions](https://github.com/kubernetes-sigs/metrics-server)) to get basic visibility into your cluster:

```shell
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

You'll then be able to do things like:

```shell
kubectl top nodes
kubectl top pods -A
```

## Install Prometheus and Grafana

Follow [these instructions](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack):

```shell
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
```

The Grafana password for the "admin" user can be viewed here:

```shell
kubectl -n monitoring get secrets prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 -d ; echo
```

To expose the UI on a subdomain, run the following. `APEX_DOMAIN` should ideally be your staging domain (as it should be behind Cloudflare Zero Trust).

```shell
cat .devops/infra/monitoring-ingress.yaml | APEX_DOMAIN=domain.com envsubst | kubectl apply -f -
```

This creates 3 subdomains:

- `grafana.domain.com`
- `prometheus.domain.com`
- `alerts.domain.com`

Then visit https://grafana.domain.com and change the admin password as soon as you log in.

Consider updating the secret value:

```shell
kubectl -n monitoring patch secret prometheus-grafana -p='{"stringData":{"admin-password": "Clear text password (not base64 encoded)"}}'
```

To view this value in the future:

```shell
kubectl -n monitoring get secrets prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 -d ; echo
```
