
# Step 1: Set up the DB

First, create the prefect database on the desired environment and make sure the `pg_trgm` extension is installed (it should already be installed on the cluster with the stackgress `SGCluster.yaml` value file):
```sql
CREATE DATABASE prefect WITH OWNER postgres;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

# Step 2: Set up env for local development

Set up your `config/.env.development` to allow Prefect's ephemeral dev server to connect with your local database:
```shell
PREFECT_API_DATABASE_CONNECTION_URL=postgresql+asyncpg://postgres:password@localhost:5432/prefect
```

# Step 3: Install the API server

We then loosely follow [these instructions](https://docs.prefect.io/v3/manage/server/examples/helm):

Add the helm repo:
```shell
helm repo add prefect https://prefecthq.github.io/prefect-helm
helm repo update
```

To see the supported values:
```shell
helm show values prefect/prefect-server > tmp/prefect-values.yaml
```

Go over the files in `.devops/prefect` and customize to your needs. Here, we do not have the chart create its own database and secret, so need to provide the secret for it.

For staging:
```shell
kubectl create ns prefect-staging
kubectl -n prefect-staging create secret generic prefect-server-postgresql-connection \
  --from-literal=connection-string=postgresql+asyncpg://postgres:$(kubectl -n db-staging get secret db-staging -o jsonpath='{.data.superuser-password}' | base64 -d)@db-staging.db-staging:5432/prefect
helm install prefect-server prefect/prefect-server -n prefect-staging -f .devops/prefect/staging/prefect-values.yaml  
```

For production:
```shell
kubectl create ns prefect-production
kubectl -n prefect-production create secret generic prefect-server-postgresql-connection \
  --from-literal=connection-string=postgresql+asyncpg://postgres:$(kubectl -n db-production get secret db-production -o jsonpath='{.data.superuser-password}' | base64 -d)@db-production.db-production:5432/prefect
helm install prefect-server prefect/prefect-server -n prefect-production -f .devops/prefect/production/prefect-values.yaml    
```

# Step 4: Setup pyproject.toml

Create a project such as `data-pipeline` and set a few keys in your `pyproject.toml`.

```toml
[tool.devops.deployment]
template = "prefect"

[[tool.devops.deployment.prefectFlows]]
flow_name = "test-flow"
script_path = "src/data_pipeline/main.py"
```

Notice that `prefectFlows` is an array, so you could spin up multiple pods based on a single data pipeline project.
Your scripts (`main.py` in this case) should call `serve` (Prefect's "dynamic infrastructure" is not supported yet)
