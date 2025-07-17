This document is currently not refereced by the main documentation. It provides a minimal setup, and will be revised when the documentation is refactored.

# Prerequisites

- Install the [gcloud CLI](https://cloud.google.com/sdk/docs/install)
- Install the kubectl auth plugin (https://cloud.google.com/kubernetes-engine/docs/how-to/cluster-access-for-kubectl#install_plugin)

Install the devops tool:

```bash
bun add @vaharoni/devops
bunx devops init
```
And pick Google Cloud as your infra.

# Setting up a cluster on Google Cloud

You can follow the first few steps of [this quickstart](https://cloud.google.com/kubernetes-engine/docs/quickstarts/create-cluster).

Or, assuming the following env vars:
```bash
export GKE_PROJECT=<your project name>
export GKE_CLUSTER=<your desired cluster name>
export GKE_REGION=us-central1
export SA_NAME=gke-sa
export SA_EMAIL=${SA_NAME}@${GKE_PROJECT}.iam.gserviceaccount.com
export SA_KEY_PATH=tmp/${SA_NAME}-key.json
```

Setup the basics:
```bash
# Project setup
gcloud config set project $GKE_PROJECT
gcloud services enable artifactregistry.googleapis.com container.googleapis.com

# Create the cluster
gcloud container clusters create-auto $GKE_CLUSTER --project=$GKE_PROJECT --region=$GKE_REGION

# Force KUBECONFIG to point to ./config/kubeconfig, otherwise the get-credentials command will update your global kubeconfig
mkdir -p config
export KUBECONFIG="$PWD/config/kubeconfig"
gcloud container clusters get-credentials $GKE_CLUSTER --region $GKE_REGION --project $GKE_PROJECT

# Setup the service account
gcloud iam service-accounts create $SA_NAME
gcloud projects add-iam-policy-binding $GKE_PROJECT --member=serviceAccount:$SA_EMAIL --role=roles/container.admin
gcloud projects add-iam-policy-binding $GKE_PROJECT --member=serviceAccount:$SA_EMAIL --role=roles/artifactregistry.createOnPushWriter
gcloud projects add-iam-policy-binding $GKE_PROJECT --member=serviceAccount:$SA_EMAIL --role=roles/container.clusterViewer
gcloud iam service-accounts keys create $SA_KEY_PATH --iam-account=$SA_EMAIL
```

# Setting up github secrets

Now, setup the github secrets:
```bash
# Setup the github secrets
gh secret set GCLOUD_PROJECT_ID --body $GKE_PROJECT
gh secret set GCLOUD_ZONE --body $GKE_REGION
gh secret set GCLOUD_SA_KEY < $SA_KEY_PATH
gh secret set GCLOUD_CLUSTER_NAME --body $GKE_CLUSTER
```

# Setting up the repo

Setup the namespaces and global resources:
```bash
./devops namespace create --env staging
./devops namespace create --env production
```

Note - this setup is incomplete, as a solution for hooking ingress to the root DNS is still being investigated.