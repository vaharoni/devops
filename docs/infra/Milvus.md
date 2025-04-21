This was not pursued yet as it requires a lot of resources from the cluster. 
Will be revisited when there is a need.

# Milvus

We follow the official Helm instructions [here](https://milvus.io/docs/install_cluster-helm.md) and [here](https://milvus.io/docs/configure-helm.md?tab=component).

All values are [here](https://raw.githubusercontent.com/milvus-io/milvus-helm/master/charts/milvus/values.yaml), and the main parameters can be configured under `extraConfigFiles` with [these value](https://github.com/milvus-io/milvus/blob/master/configs/milvus.yaml).

```
helm repo add zilliztech https://zilliztech.github.io/milvus-helm/
helm repo update
```

Install on the different environments:
```
helm install -n milvus-staging --create-namespace milvus-staging zilliztech/milvus -f .devops/milvus/staging/milvus-values.yaml
helm install -n milvus-production --create-namespace milvus-production zilliztech/milvus -f .devops/milvus/production/milvus-values.yaml
```
