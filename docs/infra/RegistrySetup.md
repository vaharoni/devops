# Registry Setup

This guide explains how to configure your Kubernetes cluster to pull images from your container registry.

## Overview

The approach depends on whether your Kubernetes cluster and container registry are from the same provider:

- **Same provider**: Use the provider's native integration (simpler)
- **Different providers**: Use `image-pull-secret-name` (more flexible)

## Same-Provider Setup

When your cluster and registry are from the same cloud provider, they typically offer native integration that handles authentication automatically.

### DigitalOcean

DigitalOcean Kubernetes (DOKS) can be integrated with DigitalOcean Container Registry (DOCR) through the control panel or CLI:

```shell
doctl kubernetes cluster registry add <cluster-name>
```

This automatically:
- Creates a docker-registry secret in all namespaces
- Patches the default service account in each namespace to use it

### Google Cloud

For GKE clusters using Artifact Registry, grant the compute service account read access:

```shell
gcloud artifacts repositories add-iam-policy-binding <repository-name> \
  --location=$CLOUDSDK_COMPUTE_REGION \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/artifactregistry.reader"
```

Replace:
- `<repository-name>` with your Artifact Registry repository name
- `$CLOUDSDK_COMPUTE_REGION` with your region (e.g., `us-central1`)
- `${PROJECT_NUMBER}` with your GCP project number

## Cross-Provider Setup (image-pull-secret-name)

When your Kubernetes cluster and container registry are from different providers (e.g., Hetzner cluster with Harbor registry, or Hetzner cluster with GCP Artifact Registry), use the `image-pull-secret-name` approach.

### How it works

1. You create a docker-registry secret with a name of your choice in the `default` namespace
2. Set `image-pull-secret-name: <your-secret-name>` in `.devops/config/constants.yaml`
3. When you run `devops namespace create`, the tool:
   - Copies the named secret from the `default` namespace to the new namespace
   - Patches the default service account to include it in `imagePullSecrets`

This allows all pods using the default service account to pull images from your registry.

**Note**: Each repo using the devops package can have its own secret name. This allows multiple repos sharing the same cluster to each configure their own registry credentials. The Kubernetes service account in each namespace can have multiple `imagePullSecrets`.

### Step 1: Create the image pull secret

Choose a secret name for your project (e.g., `myproject-registry-secret`). The secret format depends on your registry provider:

#### For Harbor (self-hosted)

See [Harbor Setup](Harbor.md) for full installation instructions.

```shell
# Important: use single quotes around username. Harbor robot accounts have $ in their name,
# which can confuse the shell if not quoted.
kubectl create secret docker-registry <your-secret-name> \
  --docker-server=registry.yourdomain.com \
  --docker-username='<robot-account-username>' \
  --docker-password=<password> \
  --docker-email=<your-email> \
  --namespace=default
```

#### For GCP Artifact Registry

Create a service account with `roles/artifactregistry.reader` and download its JSON key:

```shell
# Set your variables
export GCP_PROJECT=<your-project-id>
export SA_NAME=artifact-registry-reader

# Create the service account
gcloud iam service-accounts create $SA_NAME \
  --display-name="Artifact Registry Reader"

# Grant it read access to Artifact Registry
gcloud projects add-iam-policy-binding $GCP_PROJECT \
  --member="serviceAccount:${SA_NAME}@${GCP_PROJECT}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.reader"

# Download the JSON key
gcloud iam service-accounts keys create sa-key.json \
  --iam-account="${SA_NAME}@${GCP_PROJECT}.iam.gserviceaccount.com"
```

Then create the secret. Note: `_json_key` is a literal string that tells GCP to interpret the password as a service account JSON key:

```shell
kubectl create secret docker-registry <your-secret-name> \
  --docker-server=<REGION>-docker.pkg.dev \
  --docker-username=_json_key \
  --docker-password="$(cat sa-key.json)" \
  --docker-email="${SA_NAME}@${GCP_PROJECT}.iam.gserviceaccount.com" \
  --namespace=default
```

#### For other registries

Most registries follow the standard docker-registry secret format. Consult your registry's documentation for the specific `--docker-server`, `--docker-username`, and `--docker-password` values.

### Step 2: Configure in constants.yaml

Add or update the following in `.devops/config/constants.yaml`:

```yaml
image-pull-secret-name: <your-secret-name>
```

### Step 3: Create namespaces

When you run `devops namespace create --env <env>`, the secret will be automatically copied and the service account patched.
