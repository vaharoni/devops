# Prerequisites

- [Install direnv](https://direnv.net/docs/installation.html) (`brew install direnv`)
- [Install the github CLI](https://cli.github.com/) (`brew install gh`)
- [Install bun](https://bun.sh/docs/installation) (`brew install oven-sh/bun/bun`)
- [Install kubectl](https://kubernetes.io/docs/tasks/tools/) (`brew install kubectl`)

If you are setting up the infrastructure, you will also need:

- [Install helm](https://helm.sh/docs/intro/install/) (`brew install helm`)

# Installing the private npm package

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

```toml
# Allow installing @vaharoni/devops locally by using the personal access token
export GH_PAT_TOKEN=<token>

# Switch to the right cluster automatically
if [ -f "$PWD/tmp/kubeconfig" ]; then
  export KUBECONFIG="$PWD/tmp/kubeconfig"
else
  export KUBECONFIG="${HOME}/.kube/config"
fi
```

Make sure to add this file to `.gitignore`.

To execute this `.envrc` file whenever you cd into the directory run this from the repo folder:

```shell
direnv allow
```

Add the package and run the init command:

```shell
bun add @vaharoni/devops
devops init
```

Follow the instructions provided by the `init` command.

Then run:
```shell
bun install
```

# Setting up the database

Note that by default the `db` project exists with basic prisma configuration. It requires the `DATABASE_URL` env variable to exist. In addition, the prisma schema needs to contain some content in order for the `generate` command to return exit code 0. If you don't need a relational database for now, simply delete the folders `db` and `dml`. You can always recover back by running `devops init` again.
