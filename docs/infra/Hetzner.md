# Setting up a cluster on Hetzner

We generally follow the instructions from the [hetzner-k3s][1] repo.

## Limitations

- All nodes set up this way have their IP publically exposed. An attempt to follow [these instructions][5] to set up a NAT server failed. See the failed attempt [here](./AbandonedNATSetupHetzner.md).

## Step 1: Create the cluster

Create a new project in Heztner and follow [these instructions][2] to install `hetzner-k3s` and obtain a Read/Write API token. Save your token somewhere locally that is git-ignored, e.g. under `/tmp/keys/`. Set the `HCLOUD_TOKEN` env variable accordingly:

```shell
export HCLOUD_TOKEN=<TOKEN>
```

Locally, generate SSH keys:

```shell
ssh-keygen -t rsa -b 4096 -N "" -f ~/.ssh/id_hcloud
```

Edit the [hcloud-config.yaml](../../infra/hetzner/hcloud-config.yaml) file to suit your needs. The file was created by combining [these instructions][3] and this [tutorial][4].

For the `k3s_version` field, check the current avaiable k3s releases by running:

```shell
hetzner-k3s releases
```

Create the cluster based on the config, by running the following inside the `hetzner` directory:

```shell
hetzner-k3s create --config .devops/infra/hetzner/hcloud-config.yaml
```

If you don't already have an existing `~/.kube/config` file, simply copy `tmp/kubeconfig` over to `~/.kube/config`. Otherwise, merge the data from `tmp/kubeconfig` by copying each entry created under the key `users`, `contexts`, `clsuters` under its appropriate place in your existing `~/.kube/config`.

Regardless of the way, consider editing the `context[].name` key of the added entry in your `~/.kube/config` file to give it a friendly name, such as `hcloud`. Kubernetes uses the term "context" as a convenience to combine user information with cluster information under a single key to make it easy to switch between contexts. Assuming you did so, to test that everything works run:

```shell
kubectl config get-contexts
# Assuming the name of the context shown in the output above is indeed hcloud
kubectl config use-context hcloud
kubectl get all
```

Keep the non-merged `tmp/kubeconfig` file where it is. You'll need to set it as a github secret in the last step.

Note: if you recreate the cluster multiple times and forget to delete `tmp/kubeconfig` of older attempts, you may get with the file holding incorrect credentials leading to "You must be logged in to the server" errors when running:

```shell
KUBECONFIG=./tmp/kubeconfig kubectl get all
```

You can always find the right credentials by SSHing into the master node and printing `/etc/rancher/k3s/k3s.yaml`. That file is the same as `kubeconfig`, though note you have to change the server address to the public IP of the master node.

[1]: https://github.com/vitobotta/hetzner-k3s
[2]: https://github.com/vitobotta/hetzner-k3s/blob/main/docs/Installation.md
[3]: https://github.com/vitobotta/hetzner-k3s/blob/main/docs/Creating_a_cluster.md
[4]: https://github.com/vitobotta/hetzner-k3s/blob/main/docs/Setting%20up%20a%20cluster.md
[5]: https://github.com/vitobotta/hetzner-k3s/blob/main/docs/Private_clusters_with_public_network_interface_disabled.md

## Step 2: Set up the cluster's Ingress Controller

Edit the file [ingress-nginx-annotations.yaml](../../infra//hetzner/ingress-nginx-annotations.yaml) to suit your needs. Specifically, set `load-balancer.hetzner.cloud/location`.

Add the Ingress controller:

```shell
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm upgrade --install \
ingress-nginx ingress-nginx/ingress-nginx \
--set controller.ingressClassResource.default=true \
-f .devops/infra/hetzner/ingress-nginx-annotations.yaml \
--namespace ingress-nginx \
--create-namespace
```

Update the nginx ingress configmap:

```shell
kubectl apply -f .devops/infra/hetzner/ingress-nginx-configmap.yaml
```

## Step 3: finalize your Cloudflare setup

Follow [these instructions](./CloudFlareSetup.md) before proceeding to the next step.

## Step 4: Setup Let's encrypt cert manager

It would be nice if we could put the registry behind the cloudflare proxy to hide the IP of the Ingress controller. While it was eventually possible to make it work technically by switching Cloudflare TLS encryption mode to "full", unfortunately docker may push large layers than what Cloudflare's free version allows.

Hence, we need to exclude the registry from being served behind a proxy. We also need to have it issue its own certificate, which is what this section is about. Harbor requires a certificate to work well with github actions, and it causes many issues if it not signed by a trusted source.

```shell
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm upgrade --install \
--namespace cert-manager \
--create-namespace \
--set crds.enabled=true \
cert-manager jetstack/cert-manager
```

On Cloudflare, go to Manage Account (sidebar) > Account API Tokens > Create token > Edit Zone DNS (use template) > All zones from an account.

Then run:

```shell
cat .devops/infra/hetzner/abandoned/cert-manager.yaml | CLOUDFLARE_API_TOKEN=<token> EMAIL_ADDRESS=<your_email> envsubst | kubectl apply -f -
```

## Step 5: Setup a container registry

```shell
helm repo add harbor https://helm.goharbor.io
helm repo update
```

To see the full list of customizable values by harbor, you can run:

```shell
helm show values harbor/harbor > tmp/harbor-values.yaml
```

But in general this is unnecessary as a satisfactory [harbor-values.yaml](../../infra/hetzner/harbor-values.yaml) is already provided.

Issue a certificate from Lets Encrypt:

```shell
kubectl create ns harbor

# Replace REGISTRY_DOMAIN with the subdomain where you want the registry to be hosted.
# E.g., the `registry` subdomain under your staging domain.
cat .devops/infra/hetzner/harbor-cert.yaml | REGISTRY_DOMAIN=registry.domain.com envsubst | kubectl apply -f -

# Verify it is ready
kubectl -n harbor get certificates
```

Run the following:

```shell
export REGISTRY_DOMAIN=registry.domain.com
cat .devops/infra/hetzner/harbor-values.yaml | envsubst | helm install harbor harbor/harbor --namespace harbor --create-namespace -f -
```

On Cloudflare, add a manual DNS entry to your subdomain, e.g. `registry.domain.com` which points to the same IP of the Ingress controller. For that entry, turn off the proxy setting.

After a few moments:

1. visit your domain with user `admin` and password `Harbor12345`
2. change the admin password in the interface (top right)
3. delete the public project and create a new private one
4. in the project, add a robot account with the name `github` and Pull & Push Repository permissions. Keep the user name and password somewhere that is git-ignored. You will upload this as a github secret later on.
5. in the same project, add a robot account with the name `cluster` and Pull Repository permissions. Keep the user name and password somewhere that is git-ignored. You will upload this as a cluster secret later on.

To test that everything works, run the following:

```shell
# Replace with your value
export REGISTRY_DOMAIN=registry.domain.com
export HARBOR_PROJECT=myproj

docker login $REGISTRY_DOMAIN
docker pull nginx:alpine
docker tag nginx:alpine "$REGISTRY_DOMAIN/$HARBOR_PROJECT/nginx:alpine"
docker push "$REGISTRY_DOMAIN/$HARBOR_PROJECT/nginx:alpine"
```

## Step 6: Set up container registry secret

We need to give access to all pods to pull from our registry controller. Ideally, we would apply these to in some cluster-wide fashion. Unfortunately, this can be done either at the pod level, or at a service account level which is namespace-specific. To work around this, we set a docker-registry secret (a kind of secret) in the `harbor` namespace. When you use the `./devops k8s create env-setup` command, this secret is copied to the created namespace and the default service account is patched to use it.

```shell
# Important: notice the single quotes around username. Robot accounts on Harbor have a $ in their name,
# which can confuse the shell if we are not careful.
kubectl create secret docker-registry harbor-registry-secret \
  --docker-server=$REGISTRY_DOMAIN \
  --docker-username='<cluster username>' \
  --docker-password=<password> \
  --docker-email=<your-email> \
  --namespace=harbor
```

## Step 7: Create a storage class with Retain reclaim policy

When installing a Hetzner cluster using `hetzner-k3s`, the Hetzner CSI (Container Storage Interface) driver gets installed. By default, it installs a storage class with `Delete` reclaim policy called `hcloud-volumes` which is the cluster's default. When installing Postgres, we should have a storage class with `Retain` reclaim policy to prevent accidental data loss.

Create the storage class `hcloud-volumes-retain` by running the following:

```shell
kubectl apply -f .devops/infra/hetzner/retain-storage-class.yaml
```

## Step 8: Set up github secrets

To be able to deploy to your cluster using github actions, set the github secret `HCLOUD_KUBECONFIG` to contain the `tmp/kubeconfig` file:

```shell
gh secret set HCLOUD_KUBECONFIG < tmp/kubeconfig
```

To be able to push docker containers to the registry, run the following:

```shell
# The single quotes are important. Harbor uses $ in robot names, which messes up shell scripts unless we are careful.
gh secret set HARBOR_USER --body '<username>'
gh secret set HARBOR_PASSWORD --body <password>
```
