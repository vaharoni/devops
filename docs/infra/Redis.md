
We follow the [Bitnami Redis Helm chart](https://github.com/bitnami/charts/tree/main/bitnami/redis).

See the full values available here:

```shell
helm show values oci://registry-1.docker.io/bitnamicharts/redis > tmp/redis-values.yaml
```

Check the variables under `.devops/redis` suit your needs. 
Then use them to create the redis instances:

```shell
helm install redis-staging oci://registry-1.docker.io/bitnamicharts/redis --namespace redis-staging --create-namespace -f .devops/redis/staging/redis-values.yaml
helm install redis-production oci://registry-1.docker.io/bitnamicharts/redis --namespace redis-production --create-namespace -f .devops/redis/production/redis-values.yaml
```

To access staging from within the cluster, use the following DNS:
```shell
redis-staging-master.redis-staging.svc.cluster.local
```

To access production from within the cluster, use the following DNS:
```shell
redis-production-master.redis-production.svc.cluster.local    # for read/write operations (port 6379)
redis-production-replicas.redis-production.svc.cluster.local  # for read-only operations (port 6379)
```
