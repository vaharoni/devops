This document is currently not refereced by the main documentation. It provides a minimal setup, and will be revised when the documentation is refactored.

# Prerequisites

- Install the [gcloud CLI](https://cloud.google.com/sdk/docs/install)
- Install the kubectl auth plugin (https://cloud.google.com/kubernetes-engine/docs/how-to/cluster-access-for-kubectl#install_plugin)

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
gcloud container clusters create $GKE_CLUSTER --project=$GKE_PROJECT --zone=$GKE_REGION

echo $KUBECONFIG
# Make sure this points to config/kubeconfig under the current directory, otherwise the following will update your global kubeconfig
# If you followed the basic repo setup, this should be done automatically thanks to direnv and .envrc
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
gh secret set GCLOUD_CLUSTER_NAME --body GKE_CLUSTER
```

# Setting up the repo

In `.devops/config/constants.yaml` make sure you setup the following:
```yaml
infra: gcloud

registry-base-url: gcr.io
registry-image-path-prefix: YOUR_PROJECT_ID
```

In `.devops/manifests/ingress.yaml.hb`, remove `ingressClassName: nginx` and add under `metadata.annotations` the value `kubernetes.io/ingress.class: "gce"`. So the file should look like so:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  # ...
  annotations:
    kubernetes.io/ingress.class: "gce"    
spec:
  # Remove ingressClassName: nginx
  # ...
```

Note - this setup is incomplete, as a solution for hooking ingress to the root DNS is still being investigated.