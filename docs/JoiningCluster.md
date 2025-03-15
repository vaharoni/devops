Currently, Hetzner and Digital Ocean are supported.
You will need to receive these secrets from the administrator of the existing cluster.

## To join an existing Hetzner cluster

```shell
gh secret set HCLOUD_KUBECONFIG < tmp/kubeconfig
```

To be able to push docker containers to the registry, run the following:

```shell
# The single quotes are important. Harbor uses $ in robot names, which messes up shell scripts unless we are careful.
gh secret set HARBOR_USER --body '<username>'
gh secret set HARBOR_PASSWORD --body <password>
```

## To join an existing Digital Ocean cluster

```shell
gh secret set DIGITALOCEAN_ACCESS_TOKEN --body <token>
```

Check the name of the cluster on Digital Ocean and add it to the github repo:

```shell
doctl kubernetes cluster list
gh secret set DIGITALOCEAN_CLUSTER_NAME --body <cluster-name>
```
