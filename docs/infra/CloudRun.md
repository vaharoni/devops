# Cloud Run Setup

This guide explains how to set up Google Cloud Run with GitHub Actions using OIDC (Workload Identity Federation) for secure, keyless authentication.

## When to Use Cloud Run

Cloud Run is useful for endpoints that must be always available, such as:
- Webhook handlers (e.g., Twilio, Stripe, GitHub webhooks)
- Public APIs that can't tolerate cold starts from scaled-to-zero Kubernetes pods
- Services that benefit from automatic scaling and managed infrastructure

Cloud Run can be used alongside your Kubernetes cluster - they're not mutually exclusive.

## Overview

Cloud Run deployment with the devops package involves:

1. **One-time global setup**:
   - Enable GCP APIs and create an Artifact Registry repository
   - Set up GitHub OIDC (Workload Identity Federation) for keyless authentication

2. **Per-service setup**:
   - Create a runtime service account with appropriate permissions for each Cloud Run service

3. **GitHub configuration**:
   - Set repository variables for the GHA workflows

## Prerequisites

- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated
- A GCP project with billing enabled
- GitHub repository where you'll deploy from

## Step 1: Enable APIs and Create Artifact Registry

Run the setup script to enable required APIs and create an Artifact Registry repository:

```shell
./docs/infra/cloudrun/setup-cloudrun.sh <PROJECT_ID> <REGION> <REPOSITORY>

# Example:
./docs/infra/cloudrun/setup-cloudrun.sh my-project us-east1 cloudrun
```

This script:
- Enables `artifactregistry.googleapis.com` and `run.googleapis.com` APIs
- Creates a Docker repository in Artifact Registry
- Applies a retention policy to keep the 10 most recent images per tag

After running, update `.devops/config/constants.yaml`:

```yaml
cloudrun-artifact-registry-repo-path: <REGION>-docker.pkg.dev/<PROJECT_ID>/<REPOSITORY>
```

## Step 2: Set Up GitHub OIDC

This is the most important step. It enables GitHub Actions to authenticate to GCP without long-lived service account keys, using [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation).

```shell
./docs/infra/cloudrun/setup-github-oidc.sh <PROJECT_ID> <GITHUB_REPO>

# Example:
./docs/infra/cloudrun/setup-github-oidc.sh my-project myorg/myrepo
```

This script creates:
- A `gha-deployer` service account for GitHub Actions to impersonate
- A Workload Identity Pool (`github`) and OIDC Provider (`github-oidc`)
- IAM bindings allowing the GitHub repo to impersonate the service account
- Permissions for Artifact Registry (writer) and Cloud Run (admin)

### Optional flags

```shell
./docs/infra/cloudrun/setup-github-oidc.sh <PROJECT_ID> <REPO> \
  --pool-id github \              # Workload Identity Pool ID (default: github)
  --provider-id github-oidc \     # OIDC Provider ID (default: github-oidc)
  --sa-id gha-deployer \          # Service account name (default: gha-deployer)
  --ar-repo cloudrun \            # Scope AR permissions to specific repo (optional)
  --ar-region us-east1            # Required if --ar-repo is set
```

## Step 3: Create Runtime Service Accounts

Each Cloud Run service should run with a dedicated service account that has only the permissions it needs (principle of least privilege).

```shell
./docs/infra/cloudrun/setup-runtime-service-account.sh <PROJECT_ID> <SA_ID>

# Example:
./docs/infra/cloudrun/setup-runtime-service-account.sh my-project runtime-my-service
```

**Important**: The provided script is a template. Edit it to grant the specific roles your service needs:

| Service needs access to | Role to grant |
|------------------------|---------------|
| Pub/Sub (publish) | `roles/pubsub.publisher` |
| Pub/Sub (subscribe) | `roles/pubsub.subscriber` |
| Secret Manager | `roles/secretmanager.secretAccessor` |
| Cloud SQL | `roles/cloudsql.client` |
| Cloud Storage (read) | `roles/storage.objectViewer` |
| Cloud Storage (write) | `roles/storage.objectCreator` |
| BigQuery | `roles/bigquery.dataEditor` |

When deploying, specify the runtime service account:

```shell
./devops cloudrun deploy <image> <sha> --env <env> --region <region> \
  -- --service-account <runtime-sa-id>
```

## Step 4: Set GitHub Variables

Set the following repository variables in GitHub (Settings → Secrets and variables → Actions → Variables):

```shell
gh variable set GCP_PROJECT_ID --body "<project-id>"
gh variable set GCP_PROJECT_NUMBER --body "<project-number>"
gh variable set GCP_ARTIFACT_REGISTRY_REGION --body "<region>"
```

To find your project number:

```shell
gcloud projects describe <PROJECT_ID> --format='value(projectNumber)'
```

## Step 5: Configure GitHub Actions

The devops package provides a GitHub Action for OIDC authentication. In your workflow, use:

```yaml
permissions:
  contents: read
  id-token: write  # Required for OIDC

steps:
  - name: Connect to Artifact Registry with OIDC
    uses: ./.github/actions/registry/connect-to-artifact-registry-with-oidc@v1
    with:
      project_id: ${{ vars.GCP_PROJECT_ID }}
      project_number: ${{ vars.GCP_PROJECT_NUMBER }}
      region: ${{ vars.GCP_ARTIFACT_REGISTRY_REGION }}
```

This action:
- Authenticates to GCP via Workload Identity Federation
- Configures Docker to push to Artifact Registry

## Building and Deploying

Build and deploy a Cloud Run service:

```shell
# Build the image
CLOUDRUN_SHA=$(./devops cloudrun build-dev <image-name>)

# Deploy
./devops cloudrun deploy <image-name> $CLOUDRUN_SHA \
  --env <environment> \
  --region <region> \
  --allow-unauthenticated \  # Optional: for public services
  --forward-env VAR1,VAR2 \  # Optional: forward env vars
  -- --service-account <runtime-sa-id>
```

## Reference Scripts

The setup scripts are located in [`docs/infra/cloudrun/`](cloudrun/):

| Script | Purpose |
|--------|---------|
| [`setup-cloudrun.sh`](cloudrun/setup-cloudrun.sh) | Enable APIs, create Artifact Registry |
| [`setup-github-oidc.sh`](cloudrun/setup-github-oidc.sh) | Set up Workload Identity Federation |
| [`setup-runtime-service-account.sh`](cloudrun/setup-runtime-service-account.sh) | Create runtime SA (template) |
| [`retention-policy.json`](cloudrun/retention-policy.json) | Artifact Registry cleanup policy |

## Terraform Alternative

If you prefer Infrastructure as Code, the same setup can be achieved with Terraform. The key resources are:

- `google_project_service` - Enable APIs
- `google_artifact_registry_repository` - Create container registry
- `google_iam_workload_identity_pool` - Create WIF pool
- `google_iam_workload_identity_pool_provider` - Create OIDC provider
- `google_service_account` - Create service accounts
- `google_service_account_iam_binding` - Allow GitHub to impersonate SA
- `google_project_iam_member` - Grant roles

See Google's [Terraform module for GitHub OIDC](https://github.com/terraform-google-modules/terraform-google-github-actions-runners/tree/master/modules/gh-oidc) for a reference implementation.
