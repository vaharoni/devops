# Setting up a cluster on Hetzner

We generally follow the instructions from the [hetzner-k3s][1] repo.

## Limitations

- All nodes set up this way have their IP publically exposed. An attempt to follow [these instructions][5] to set up a NAT server failed. See the failed attempt [here](AbandonedNATSetupHetzner.md).

## Step 1: Create the cluster

Create a new project in Heztner and follow [these instructions][2] to install `hetzner-k3s` and obtain a Read/Write API token. Save your token somewhere locally that is git-ignored, e.g. under `/tmp/keys/`. Set the `HCLOUD_TOKEN` env variable accordingly:

```shell
export HCLOUD_TOKEN=<TOKEN>
```

Locally, generate SSH keys:

```shell
ssh-keygen -t rsa -b 4096 -N "" -f ~/.ssh/id_hcloud
```

Edit the `.devops/infra/hetzner/hcloud-config.yaml` file that was generated after running `bunx devops init` to suit your needs. The file was created by combining [these instructions][3] and this [tutorial][4].

For the `k3s_version` field, check the current avaiable k3s releases by running:

```shell
hetzner-k3s releases
```

Create the cluster based on the config, by running the following inside the `hetzner` directory:

```shell
hetzner-k3s create --config .devops/infra/hetzner/hcloud-config.yaml
```

If you don't already have an existing `~/.kube/config` file, simply copy `config/kubeconfig` over to `~/.kube/config`. Otherwise, merge the data from `config/kubeconfig` by copying each entry created under the key `users`, `contexts`, `clsuters` under its appropriate place in your existing `~/.kube/config`.

Regardless of the way, consider editing the `context[].name` key of the added entry in your `~/.kube/config` file to give it a friendly name, such as `hcloud`. Kubernetes uses the term "context" as a convenience to combine user information with cluster information under a single key to make it easy to switch between contexts. Assuming you did so, to test that everything works run:

```shell
kubectl config get-contexts
# Assuming the name of the context shown in the output above is indeed hcloud
kubectl config use-context hcloud
kubectl get all
```

Keep the non-merged `config/kubeconfig` file where it is. You'll need to set it as a github secret in the last step.

Note: if you recreate the cluster multiple times and forget to delete `config/kubeconfig` of older attempts, you may get with the file holding incorrect credentials leading to "You must be logged in to the server" errors when running:

```shell
KUBECONFIG=./config/kubeconfig kubectl get all
```

You can always find the right credentials by SSHing into the master node and printing `/etc/rancher/k3s/k3s.yaml`. That file is the same as `kubeconfig`, though note you have to change the server address to the public IP of the master node.

[1]: https://github.com/vitobotta/hetzner-k3s
[2]: https://github.com/vitobotta/hetzner-k3s/blob/main/docs/Installation.md
[3]: https://github.com/vitobotta/hetzner-k3s/blob/main/docs/Creating_a_cluster.md
[4]: https://github.com/vitobotta/hetzner-k3s/blob/main/docs/Setting%20up%20a%20cluster.md
[5]: https://github.com/vitobotta/hetzner-k3s/blob/main/docs/Private_clusters_with_public_network_interface_disabled.md

## Step 2: Set up the cluster's Ingress Controller

Edit the file `.devops/infra/hetzner/ingress-nginx-annotations.yaml` to suit your needs. Specifically, set `load-balancer.hetzner.cloud/location`.

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

Follow [these instructions](CloudFlareSetup.md) before proceeding to the next step.

## Step 4: Setup the container registry

For Hetzner clusters, we recommend using Harbor as a self-hosted container registry. Follow the [Harbor setup guide](Harbor.md) to install and configure it.

Once Harbor is set up, see [Registry Setup](RegistrySetup.md) for instructions on configuring your cluster to pull images from it.

## Step 5: Create a storage class with Retain reclaim policy

When installing a Hetzner cluster using `hetzner-k3s`, the Hetzner CSI (Container Storage Interface) driver gets installed. By default, it installs a storage class with `Delete` reclaim policy called `hcloud-volumes` which is the cluster's default. When installing Postgres, we should have a storage class with `Retain` reclaim policy to prevent accidental data loss.

Create the storage class `hcloud-volumes-retain` by running the following:

```shell
kubectl apply -f .devops/infra/hetzner/retain-storage-class.yaml
```

## Step 6: Set up github secrets

To be able to deploy to your cluster using github actions, set the github secret `HCLOUD_KUBECONFIG` to contain the `config/kubeconfig` file:

```shell
gh secret set HCLOUD_KUBECONFIG < config/kubeconfig
```

To be able to push docker containers to the registry, run the following:

```shell
# The single quotes are important. Harbor uses $ in robot names, which messes up shell scripts unless we are careful.
gh secret set HARBOR_USER --body '<username>'
gh secret set HARBOR_PASSWORD --body <password>
```
