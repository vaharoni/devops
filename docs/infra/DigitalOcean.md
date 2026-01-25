# Setting up a cluster on Digital Ocean

## Step 1: Setup infra on Digital Ocean UI

1. Create a project
2. Create a cluster in the project with the desired nodes
3. Follow the instructions to configure `kubectl` to point to the newly created cluster
4. Sign up to a container registry plan with at least 2 repositories (one for staging, one for production)
5. Integrate your registry with your cluster via the control panel or by running:
   ```shell
   doctl kubernetes cluster registry add <cluster-name>
   ```

For more details on registry configuration, see [Registry Setup](RegistrySetup.md).

## Step 2: Set up the cluster's Ingress Controller

Setup an Ingress Controller (based on the [tutorial](https://www.digitalocean.com/community/tutorials/how-to-set-up-an-nginx-ingress-on-digitalocean-kubernetes-using-helm)):

```shell
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install nginx-ingress ingress-nginx/ingress-nginx --set controller.publishService.enabled=true
```

## Step 3: Finalize your Cloudflare setup

Follow [these instructions](CloudFlareSetup.md).

## Step 4: Set up github secrets

Create an access token on Digital Ocean with a custom scope of "registry". Select all sub scopes.
Once it is created, add it to the github repo:

```shell
gh secret set DIGITALOCEAN_ACCESS_TOKEN --body <token>
```

Check the name of the cluster on Digital Ocean and add it to the github repo:

```shell
doctl kubernetes cluster list
gh secret set DIGITALOCEAN_CLUSTER_NAME --body <cluster-name>
```
