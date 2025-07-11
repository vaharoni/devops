Note: instead of requiring a global install that makes `devops` available globally from the command line, a small wrapper script is available as `./devops` which essentially prefixes the command with `bunx`.

# Prerequisites

## Install some software

- [Install the github CLI](https://cli.github.com/) (`brew install gh`)
- [Install bun](https://bun.sh/docs/installation) (`brew install oven-sh/bun/bun`)
- [Install kubectl](https://kubernetes.io/docs/tasks/tools/) (`brew install kubectl`)

If you are setting up the infrastructure, you will also need:

- [Install helm](https://helm.sh/docs/intro/install/) (`brew install helm`)

## Setup direnv (recommended)

Optionally, setup direnv so that when you cd into the project directory `kubectl` will point to the right cluster. If you skip this step, you'll have to remember to switch to the right kubernetes context manually before running `./devops` command.

[Install direnv](https://direnv.net/docs/installation.html) (`brew install direnv`).

Then create an `.envrc` file with the following content: 
```bash
if [ -f "$PWD/config/kubeconfig" ]; then
  export KUBECONFIG="$PWD/config/kubeconfig"
else
  export KUBECONFIG="$HOME/.kube/config"
fi
```

And run:
```bash
direnv allow
```

# Scenario 1: Cloning an existing repository that already works with an existing cluster

Place the `kubeconfig` file you receive from the administrator under the `config` folder. If you followed the "setup direnv" instructions above, this path is set by `.envrc` to automatically use the right cluster whenever you cd into the project directory. 

That's it. You can now use the `./devops` CLI.

# Scenario 2: Creating a new repository that joins an existing cluster

First, obtain a `kubeconfig` from the administrator and place it under the `config` folder.

## Step 1: Create a new repo and set up the devops tool

Initialize an empty bun project with `bun init`. Add the `devops` dependency and run `init`:
```shell
bun add @vaharoni/devops
bunx devops init
```
Make sure to follow the instructions that the `devops init` command outputs.

Then, install dependencies:
```shell
bun install
```

If you aren't creating your own kubernetes cluster, postgres cluster, redis cluster, prefect server, or milvus cluster you can safely delete the folders `infra`, `postgres`, `redis`, `prefect`, and `milvus` under `.devops`.

To avoid versioning issues, you should not add the `@vaharoni/devops` package in the `package.json` of libs or apps inside the monorepo. They will be able to import it thanks to the repo-wide installation.

## Step 2: Create your repo-specific namespaces

Updade the file `.devops/config/constants.yaml` that was created after running `bunx devops init`.

Then create your staging and production namespaces:
```shell
./devops namespace create --env staging
./devops namespace create --env production
```

## Step 3: Creating or connecting to the Postgres cluster

By default, `bunx devops init` creates a `db` project with a basic prisma configuration. In this bare minimum state, it will prevent deployments from completing successfully for two reasons:
- it requires the `DATABASE_URL` env variable to exist. If you're reusing the existing Postgres cluster, you'll want to have the administrator create a database schema for you. You can then run something like `./devops env set DATABASE_URL=<url> --env staging` to set up this env variable. If you're creating an entirely new database cluster, you will want to follow the [Postgres setup guide](./infra/Postgres.md), skipping the "Install the operator" step.
- the prisma schema needs to contain some content in order for the `prisma generate` command to work without failing. You'll need to set up your first application table before proceeding.

If you don't need a relational database for now, simply delete the folders `db` and `dml` (the latter depends on the former). You can always recover them back by running `bunx devops init` again (it does not override changes you make).

## Step 4: Uploading github secrets

### When joining an existing Hetzner cluster

```shell
gh secret set HCLOUD_KUBECONFIG < config/kubeconfig
```

To be able to push docker containers to the registry, run the following:

```shell
# The single quotes are important. Harbor uses $ in robot names, which messes up shell scripts unless we are careful.
gh secret set HARBOR_USER --body '<username>'
gh secret set HARBOR_PASSWORD --body <password>
```

### When joining an existing Digital Ocean cluster

```shell
gh secret set DIGITALOCEAN_ACCESS_TOKEN --body <token>
```

Check the name of the cluster on Digital Ocean and add it to the github repo:

```shell
doctl kubernetes cluster list
gh secret set DIGITALOCEAN_CLUSTER_NAME --body <cluster-name>
```

# Scenario 3: Creating a new cluster

First, follow step 1 of scenario 2 above.
Then, follow the guide [How to setup a Kubernetes cluster infrastructure](./infra/README.md) to create a cluster and obtain a `kubeconfig` file. 
Place the file under the `config` folder, and follow steps 2 and 3 of scenario 2.