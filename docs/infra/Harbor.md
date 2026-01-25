# Setting up Harbor as a Container Registry

Harbor is a self-hosted container registry that can be deployed on any Kubernetes cluster. This guide covers installing Harbor and configuring it for use with this devops toolkit.

## Prerequisites

- A running Kubernetes cluster with an Ingress controller
- Helm installed
- A domain for the registry (e.g., `registry.yourdomain.com`)
- cert-manager installed (for TLS certificates)

## Step 1: Setup cert-manager (if not already installed)

If you haven't already set up cert-manager, install it:

```shell
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm upgrade --install \
--namespace cert-manager \
--create-namespace \
--set crds.enabled=true \
cert-manager jetstack/cert-manager
```

For Cloudflare DNS validation, create an API token with "Edit Zone DNS" permissions, then apply the issuer:

```shell
cat .devops/infra/hetzner/cert-manager.yaml | CLOUDFLARE_API_TOKEN=<token> EMAIL_ADDRESS=<your_email> envsubst | kubectl apply -f -
```

## Step 2: Install Harbor

```shell
helm repo add harbor https://helm.goharbor.io
helm repo update
```

To see the full list of customizable values:

```shell
helm show values harbor/harbor > tmp/harbor-values.yaml
```

Issue a certificate from Let's Encrypt:

```shell
kubectl create ns harbor

# Replace REGISTRY_DOMAIN with your registry subdomain
cat .devops/infra/hetzner/harbor-cert.yaml | REGISTRY_DOMAIN=registry.domain.com envsubst | kubectl apply -f -

# Verify the certificate is ready
kubectl -n harbor get certificates
```

Install Harbor:

```shell
export REGISTRY_DOMAIN=registry.domain.com
cat .devops/infra/hetzner/harbor-values.yaml | envsubst | helm install harbor harbor/harbor --namespace harbor --create-namespace -f -
```

## Step 3: Configure DNS

Add a DNS entry for your registry domain (e.g., `registry.domain.com`) pointing to your Ingress controller's IP address.

**Important**: If using Cloudflare, turn off the proxy setting for this entry. Harbor needs direct access for large layer uploads that may exceed Cloudflare's free tier limits.

## Step 4: Configure Harbor

After a few moments:

1. Visit your domain with user `admin` and password `Harbor12345`
2. Change the admin password (top right menu)
3. Delete the public project and create a new private one
4. In the project, add a robot account with the name `github` and Pull & Push Repository permissions. Save the credentials for GitHub Actions.
5. In the same project, add a robot account with the name `cluster` and Pull Repository permissions. Save the credentials for the cluster secret.

## Step 5: Test the setup

```shell
export REGISTRY_DOMAIN=registry.domain.com
export HARBOR_PROJECT=myproj

docker login $REGISTRY_DOMAIN
docker pull nginx:alpine
docker tag nginx:alpine "$REGISTRY_DOMAIN/$HARBOR_PROJECT/nginx:alpine"
docker push "$REGISTRY_DOMAIN/$HARBOR_PROJECT/nginx:alpine"
```

## Step 6: Create the external-registry-secret

Create the secret that will be used by your cluster to pull images:

```shell
# Important: notice the single quotes around username. Robot accounts on Harbor have a $ in their name,
# which can confuse the shell if we are not careful.
kubectl create secret docker-registry external-registry-secret \
  --docker-server=$REGISTRY_DOMAIN \
  --docker-username='<cluster robot username>' \
  --docker-password=<password> \
  --docker-email=<your-email> \
  --namespace=default
```

When you run `devops namespace create`, this secret will be automatically copied to the new namespace and the default service account will be patched to use it.

## Step 7: Set up GitHub secrets

To enable GitHub Actions to push images to Harbor:

```shell
# The single quotes are important. Harbor uses $ in robot names.
gh secret set HARBOR_USER --body '<github robot username>'
gh secret set HARBOR_PASSWORD --body <password>
```
