# Development

## How to work with environment variables

All `./devops` commands work under a certain `MONOREPO_ENV`. This is typically set by running `--env`, but if the `MONOREPO_ENV` variable is present it takes precedence. Most commands affect some remote state, and thus can only work with `staging` and `production` environments. Some local commands can also work with `development` and `test` environments.

To declare env variables locally, use the `config` folder. This folder can contain the following `.env` files:
- `.env.global` - environment variables that are applied regardless of the environment
- `.env.<env>` - environment variables that are applied depending on which environment the command is executed under (e.g. `.env.development` and `.env.test`).

This means you could do something like this:
```shell
./devops run my-app:dev --env staging
```
which injects all global variables in `.env.global` and `.env.staging` to the running process. This allows you to run a service locally and test it against the remote staging database, for example. 

Pods that run on the cluster on either staging or production take their environment variables from a Kubernetes Secret of their respective environment. You can control this Secret with `./devops env`, e.g.:
```shell
./devops env set KEY1=key1 KEY2=key2 --env staging
./devops env delete KEY1 KEY2 --env staging
```

If you change a remote environment variable, you must restart the pods that rely on it for it to take effect:
```shell
kubectl get ns
# Assuming the above found project-staging is the staging namespace
kubectl get deploy -n project-staging
# Assuming the above found my-deployment deployment in the staging namespace
kubectl rollout restart deploy my-deployment -n project-staging
```

In order to find missing environment variables as soon as possible, each app or lib should declare its environment variable dependencies in a file called `env.yaml`. This file should be placed in the root of that app or lib, i.e. where the package file resides. All `./devops` commands inject the environment variables based on the `MONOREPO_ENV`, and then validate them based on all `env.yaml` files present.
See the [env.example.yaml](../src/target-templates/.devops/env.example.yaml) file to learn more about the file's structure.

## How to install packages inside existing apps and libs

In general, you can execute the `add` command inside the folder where the package file of the app or lib resides. There are convenient shortcuts for this:

```shell
# Node
./devops exec --in my-app bun add some-package

# Python
./devopspy exec --in my-app uv add some-package
# Altnerative
uv --package my-app add some-package
```

## How to add a new application

To add a new app:
```bash
# Node
bun init applications/my-new-app

# Python
uv init applications/my-new-app
```

Apps typically have a `deployment` entry in their package file. 
The structure of this entry can be found [here](../src/types/index.ts).

An example for Node:
```json
"deployment": {
  "template": "external-service",
  "service_name": "www",
  "port": 4001,
  "subdomain": "www"
}
```

An example for Python:
```toml
[tool.devops.deployment]
template = "external-service"
service_name = "www"
port = 4001
subdomain = "www"
```

The `template` entry under the `deployment` determines which kubernetes manifests are generated when deploying the app. This is based on the `.devops/manifests` folder that was generated when running `bunx devops init`. You can modify it as you see fit. You can see its default content [here](../src/target-templates/.devops/manifests/). The templates are defined in the [`_index.yaml`](../src/target-templates/.devops/manifests/_index.yaml) file. This file contains the handlebar files that are concatenated during generation. A few helpful commands can help figure out what's available:
```shell
# Show what handlebar object will be injected into the manifest when generating my-app
./devops template context deployment my-app
# Performs the manifest generation for an example dummy image
./devops template gen deployment my-app
```

You can override any of the manifests generated for a specific workspace by creating a `manifests` folder under its root. All files present under `manifests` are deep-merged with the manifests generated based on the template. The `./devops template gen deployment` command shows the resulting generation including the overrides under `manifests`.

In order for the app to be deployed in an image, you must declare the app under the `applications` entry of one of the images in `.devops/config/images.yaml`. For example:
```yaml
my-image:
  # ...
  applications:
  # ...
  - my-new-app
```

The way the app starts itself in the cluster depends on the template that is declared under the `deployment` entry in the package file. In the common `external-service`, `internal-service`, or `backend-process` default templates, the project name is sent as an execution argument to the docker container. The default docker image executes `./devops run <project-name>:start` or `/.devopspy run <project-name>:start`. So the `start` script is usually required. A `dev` script is also typical and convenient to have.

In Node, define them under the usual `scripts` entry:
```json
"scripts": {
  "dev": "next dev --turbopack -p 4001",
  "start": "next start -p 4001",
}
```

In Python we use a custom solution:
```toml
[tool.devops.scripts]
dev = "python -c 'from src.my_app.scripts import dev; dev()'"
start = "python -c 'from src.my_app.scripts import start; start()'"
```

Note that the default kubernetes manifests for cron jobs and Prefect flows do not follow the `start` convention.

In addition to the default `start` script, the `generate` and `build` "lifecycle hooks" can be defined by any workspace (app / lib). The default docker build processes for Node and Python run the `generate` script for all workspaces that define them. This execution is performed in parallel. After all `generate` scripts complete, all `build` scripts are similarily executed. Use the `generate` script to execute code generators and the `build` script for transpiling and packing.

## How to add a new library

To add a new library:
```shell
# Node
bun init libs/my-new-lib

# Python
uv init libs/my-new-lib
```

In Python, you must also add a build system to the lib's `pyproject.toml` in order for the lib to be installable by apps:
```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

To add the lib as a dependency, do the following.

In Node, point the package manager to `workspace:*` in `package.json`:
```json
"dependencies": {
  "my-lib": "workspace:*"
}
```

In Python, run:
```shell
uv --package my-dependent-app add my-new-lib
```

Unlike applications, you do not need to make changes to the `.devops/config/images.yaml` file. An image that contains an app that depends on a lib will have that lib copied as part of the build process.

# Deployment

## How to deploy to staging or production

THe default github actions generated by the tool watch the `staging` and `production` branches. Merge your work to these branches and push. 

Typically, the `main` branch should be the linear source of truth. The `staging` and `production` braches have the work committed to `main` appended to them linearly:

```shell
git checkout staging
git merge main --ff-only
git push
```

If hot fixes are needed in production, or feature branches are tested on staging, this invariant may temporarily not hold. Ocasionally, sync `main` with these branches by resetting them and force pushing:

```shell
git checkout main
git branch -D staging
git checkout -b staging
git push --set-upstream origin staging --force
```

# Troubleshooting cluster resources

## How to see the logs of a service in production or staging

First, get the deployment name for which you want to see the logs:

```shell
# Find all namespaces
kubectl get ns
# Assuming your staging environment is under project-staging namespace, find all deployments
kubectl -n project-staging get deploy
```

Then, run something like:
```shell
# Assuming the deployment is called my-app
kubectl -n project-staging logs deploy/my-app
kubectl -n project-staging logs deploy/my-app --follow
kubectl -n project-staging logs deploy/my-app --timestamps
```

Run `kubectl logs --help` to see all available options.

## How to obtain a remote shell into the cluster

Each image runs a lean debug pod that can provide a shell into the cluster. This pod runs the latest successfully deployed version of that image. To get a shell access to this pod, run:

```shell
./devops console <image-name> --env staging
```


# TBD: Future topics

- How to use the internal cron scheduler
- How to work with the SDK for service discovery
- How to work with the SDK for traffic origin validation