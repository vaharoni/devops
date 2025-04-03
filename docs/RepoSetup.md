Note: a global install such as `bun install -g @vaharoni/devops` would have been nice, as it would have allowed to just run `devops`. Unfortunately, it doesn't work with private packages without some hacks. So instead of `devops`, a small wrapper script is available as `./devops` which essentially prefixes the command with `bunx`.

# Prerequisites

## Install some software

- [Install direnv](https://direnv.net/docs/installation.html) (`brew install direnv`)
- [Install the github CLI](https://cli.github.com/) (`brew install gh`)
- [Install bun](https://bun.sh/docs/installation) (`brew install oven-sh/bun/bun`)
- [Install kubectl](https://kubernetes.io/docs/tasks/tools/) (`brew install kubectl`)

If you are setting up the infrastructure, you will also need:

- [Install helm](https://helm.sh/docs/intro/install/) (`brew install helm`)

## Obtain access to the private npm package

Create `.npmrc` with the following content:

```text
@vaharoni:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GH_PAT_TOKEN}
```

Then, follow [these instructions][1] to create a classic personal access token (PAT) on Github with `read:packages` permission.

[1]: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token

Push the token to github secrets:

```shell
gh secret set GH_PAT_TOKEN --body <token>
```

and store the same token in a `.envrc` file with the following content:

```shell
# Allow installing @vaharoni/devops locally by using the personal access token
export GH_PAT_TOKEN=<token>

# Switch to the right cluster automatically
if [ -f "$PWD/config/kubeconfig" ]; then
  export KUBECONFIG="$PWD/config/kubeconfig"
else
  export KUBECONFIG="${HOME}/.kube/config"
fi
```

Make sure to add the following to your `.gitignore`:
```text
.envrc
**/.DS_Store
**/.env*
config/kubeconfig
tmp/**
!tmp/**/.gitkeep
```

To execute this `.envrc` file whenever you cd into the directory run this from the repo folder:

```shell
direnv allow
```

# Scenario 1: Cloning an existing repository that already works with an existing cluster

Place the `kubeconfig` file you receive from the administrator under `config/kubeconfig`. This path is set by `.envrc` to automatically use the right cluster whenever you cd into the project directory.

That's it. You can now use all the power of the `devops` CLI.

# Scenario 2: Creating a new repository that joins an existing cluster

First, set up you `kubeconfig` per the instructions of scenario 1.

## Step 1: Install the SDK and generate code

Install the CLI and run the `init` command. Make sure to follow the instructions that it outputs:
```shell
bun install @vaharoni/devops
bunx devops init
```

Then install the dependencies:
```shell
bun install
```

If you aren't creating your own kubernetes cluster, postgres cluster, redis cluster, prefect server, or milvus cluster you can safely delete the folders `infra`, `postgres`, `redis`, `prefect`, and `milvus` under `.devops`.

Install the SDK into the root package of your repo by adding the same package to the project (in the future these may be separated to different packages):

```shell
bun add @vaharoni/devops
```

To avoid versioning issues, you should not add the `@vaharoni/devops` package in the `package.json` of libs or apps inside the monorepo. They will be able to import it thanks to the repo-wide installation.

## Step 2: Create your repo-specific namespaces

Updade the file `.devops/config/constants.yaml` that was created after running `./devops init`.

Then create your staging and production namespaces:
```shell
./devops k8s create env-setup --env staging
./devops k8s create env-setup --env production
```

## Step 3: Creating or connecting to the Postgres cluster

By default, `./devops init` creates a `db` project with a basic prisma configuration. In this bare minimum state, it will prevent deployments from completing successfully for two reasons:
- it requires the `DATABASE_URL` env variable to exist. If you're reusing the existing Postgres cluster, you'll want to have the administrator create a database schema for you. You can then run something like `./devops env set DATABASE_URL=<url> --env staging` to set up this env variable. If you're creating an entirely new database cluster, you will want to follow the [Postgres setup guide](./infra/Postgres.md), skipping the "Install the operator" step.
- the prisma schema needs to contain some content in order for the `prisma generate` command to work without failing. You'll need to set up your first application table before proceeding.

If you don't need a relational database for now, simply delete the folders `db` and `dml` (the latter depends on the former). You can always recover them back by running `./devops init` again (it does not override any changes you make otherwise).

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

Follow the guide [How to setup a Kubernetes cluster infrastructure](./infra/README.md).