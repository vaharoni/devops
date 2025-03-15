# Overview

We follow [StackGres](https://stackgres.io/doc/latest/) to install Postgres on our cluster. Similarly to other solutions (e.g. Crunchy Data), StackGres provides all the expected features such as as backups, point-in-time-recovery (PITR), and High Availability setup. But it also offers a few distinct advantages beyond these basics:

1. It makes it very easy to install Postgres extensions
2. It supports Citus out of the box

While we do not install Citus as part of this initial setup, having the capability to (relatively) easily install Citus if ever needed is advantegeous.

## Step 1: Install the operator

```shell
helm repo add stackgres-charts https://stackgres.io/downloads/stackgres-k8s/stackgres/helm/
helm repo update
helm install --create-namespace --namespace stackgres stackgres-operator \
 --set grafana.autoEmbed=true \
 --set-string grafana.webHost=prometheus-grafana.monitoring \
 --set-string grafana.secretNamespace=monitoring \
 --set-string grafana.secretName=prometheus-grafana \
 --set-string grafana.secretUserKey=admin-user \
 --set-string grafana.secretPasswordKey=admin-password \
 stackgres-charts/stackgres-operator
```

The operator includes an admin UI. To expose the UI on a subdomain, run the following. `APEX_DOMAIN` should ideally be your staging domain (as it should be behind Cloudflare Zero Trust).

```shell
cat .devops/infra/stackgres-ui-ingress.yaml | APEX_DOMAIN=domain.com envsubst | kubectl apply -f -
```

This exposes the UI under the `db` subdomain.

To get the user and password for the admin UI:

```shell
kubectl get secret -n stackgres stackgres-restapi-admin --template '{{ printf "username = %s\n" (.data.k8sUsername | base64decode) }}'
kubectl get secret -n stackgres stackgres-restapi-admin --template '{{ printf "password = %s\n" (.data.clearPassword | base64decode) }}'
```

Stackgres recommends to keep the auto-generated password somewhere safe and then remove it from the secret by running the following. Note that then you won't be able to get the password by running `devops db password ui`:

```shell
kubectl patch secret -n stackgres stackgres-restapi-admin --type json -p '[{"op":"remove","path":"/data/clearPassword"}]'
```

## Step 2: Create an S3 bucket for backups

Either on Hetzner or on AWS, create a bucket for backups. For S3, follow the instructions [here](https://stackgres.io/doc/latest/administration/backups/eks/).
Keep the access key and secret key somewhere that is git-ignored.

We need to set a secret in the namespace of each of our clusters.
So first, let's create the namespaces:

```shell
kubectl create ns db-staging
kubectl create ns db-production
```

For Hetzner, the following Secret creation instructions were used:

```shell
accessKey=<accessKey>
secretKey=<secretKey>

kubectl -n db-staging create secret generic s3-backup-bucket-secret \
        --from-literal="accessKey=$accessKey" \
        --from-literal="secretKey=$secretKey"

kubectl -n db-production create secret generic s3-backup-bucket-secret \
        --from-literal="accessKey=$accessKey" \
        --from-literal="secretKey=$secretKey"
```

## Step 3: Creating and configuring the cluster

This was loosely based on [this repo](https://gitlab.com/ongresinc/stackgres.git), which was referenced in [this part](https://stackgres.io/doc/latest/administration/cluster-creation/best-practices/) of the documentation.

However, most files were removed in favor of the defaults. The defaults that Stackgres applies can be found in [StackgresDefaults.md](StackgresDefaults.md). Also, it seems that some of the examples refer to old naming conventions with regards to labels. `role=master` was replaced by `role=primary`, and `cluster` and `cluster-name` are now preceded by `stackgres.io/`.

Go through the files under `devops/postgres` and check the configuration. In particular, you will likely need to adjust:

- `devops/postgres/*/cluster/SGCluster.yaml` - check out the size of the persistent volume, the number of instances, and the storage class
- `devops/postgres/*/configurations/07-SGObjectStorage.yaml` - check out the bucket name and endpoint
- `devops/postgres/*/configurations/08-SGScript.yaml` - check out the script name of the database created

To create the clusters, run:

```shell
kubectl apply -f .devops/postgres/staging/configurations
kubectl apply -f .devops/postgres/staging/cluster

kubectl apply -f .devops/postgres/production/configurations
kubectl apply -f .devops/postgres/production/cluster
```

## Step 4: Setup the DATABASE_URL env variables in your cluster

In general, the databases should be accessible from within the cluster through the following DNS addresses:
```shell
db-staging.db-staging
db-production.db-production
```

The specific setup here may be different depending on how you choose to create your application databases inside the `08-SGScript.yaml` files.

Here is a simple example on how to do this for the staging database.

First, figure out the super user password:
```shell
devops db password db-staging
```

Then set up the env variable accordingly (in this example for a database called `glitchy`):
```shell
devops env set DATABASE_URL=postgresql://postgres:<password>@db-staging.db-staging:5432/glitchy --env staging
```