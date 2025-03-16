# The devops architecture

## Overview of the monorepo structure

The main idea is for a single k8s cluster to be able to support multiple projects. Each of these projects is expected to have its own git monorepo.

Each project needs to support multiple applications (e.g. an API and a web app). Each of these applications could depend on third party libraries as well as libraries within the monorepo, typically under `libs`.

Each application is backed by a single Docker image, and each Docker image could back multiple applications. This mapping is declared in `.devops/config/images.yaml` that was generated after running `devops init`. The node-based Docker build process includes copying all applications and their internal dependencies to a temporary folder, running `bun install`, running the script named `generate` in all `package.json` files that were copied, and then running the script `build` similarly. This requires the tool to be aware of internal dependencies in `package.json`, which is done by leveraging npm workspaces specifications. This means that if an application package called `www` depends on a library package whose `name` field in its `package.json` is `@local/some-lib`, the `package.json` of `www` should include the special `workspace:*` directive like so:

```json
"dependencies": {
  "@local/some-lib": "workspace:*"
}
```

It is advised to name all libs with `@local/` prefix while keeping applications without that prefix to distinguish their pecking order, but this is not a requirement.

Speaking of npm workspaces, the root `package.json` contains a list of all locations where `package.json` files are expected to reside. It contains:

- `.devops` - contains some configuration that was generated when running `devops init` and then modified to adapt to the specific needs of the repo
- `applications` - each application is expected to run on the cluster in some fashion
- `libs` - all libs to allow code reuse across applications
- `db` - this is a special project. During deployment, all applications that depend on it will trigger the execution of a github action that runs the `migrate-deploy` script in the `db` project exactly once, if its code changed since the last deployment.
- `dml` - this is a special project. It should be declared as an application dependency in one of the images in `config/images.yaml`, as typically no `package.json` file should declare it as a dependency. The `devops dml` command assists in creating and executing DML scripts. Other than being supported by `devops dml`, there is nothing special about these scripts and they could be periodically deleted from the repo.

Each application project should have in its `package.json` a custom key called `deployment` that defines how it should be deployed onto the cluster. The [types file](../src/types/index.ts) contains the specifications of the structure. Here is an example:

```json
"deployment": {
  "template": "external-service",
  "service-name": "www",
  "port": 3000
}
```

Kubernetes works with YAML files called manifests. The example configuration above tells the deployment workflow to generate k8s manifests based on the `external-service` template for the project. A list of all supported templates can be found [here](../src/k8s/composite-templates.yaml). The example above tells the `external-service` template to accept connections under the `www` subdomain and hook them to port 3000 in the running process. If the cluster is set up correctly, as soon as the deployment is complete the `www` subdomain will start serving requests under the staging or production domains, depending on which environment it was deployed to.

During the deployment process, in addition to deploying manifests per application, an extra debug pod is deployed for each image. This allows getting a shell to the latest deployed image in the cluster by running `devops console`. This could be useful for debugging and running DMLs. To support this, every image should have in its `config/images.yaml` an entry called `debug-template` which should correspond to one of [these templates](../src/k8s/composite-templates.yaml) folder.

## Key cluster objects

For each project, there are typically 2 environments - one for production and one for staging. These are reflected in k8s namespaces and should be created once by running `devops k8s create env-setup` for each environment.

Each environment has a `Secret` object that contains all the env variables for that environment. Each pod first mounts this secret as a `.env` file which is injected when using `devops run` or `devops exec` to execute scripts. You can manage environment variables using `devops env`. To help catch missing environment variables early, each package (i.e. application or lib) can declare its environment dependencies in an `env.yaml` file. The `devops run` and `devops exec` commands first check that the mounted `Secret` conforms with the dependencies declared in all `env.yaml` files. Check out the structure of `env.yaml` files in the `.devops/env.example.yaml` that was generated after running `devops init`.

In addition, each image maintains a `ConfigMap` object per environment where the latest git SHA of its successful deployment is stored. This `ConfigMap` is updated as the very last step of the deployment process by the github action. When a deployment workflow begins, each image retrieves this version and checks to see whether any of its content were updated between the `HEAD` commit and that version. If there were changes in any file in one of the packages the image depends on, the image is deemed "affected" and is built and deployed. In a multi image setup, this can speed up deployment as only relevant images are rebuilt.

To protect against scenarios of faulty code or missing environment dependencies, the template of web-based applications executes a "startup probe" that performs a GET request to the `/healthz` path. If anything but 200 is returned, the pod is considered unhealthy, and the old code continues running. Therefore, after each deployment it is recommended to run `kubectl get pods -n <namespace>` and check the deployment status in kubernetes (namespace is typically `<project>-staging` or `<project>-production`). You can also run `kubectl get pods -A` to get all running pods in the cluster. If you find errors, you can further debug the situation by running `kunbectl logs <pod-name> -n <namespace>` or `kubectl describe pods/<pod-name> -n <namespace>`.

Note that the latest deployed version stored in the `ConfigMap` is set by github actions before the startup probe is deemed successful. If the probe fails, typically this does not lead to an issue as after you fix the problem in code and re-push the image will be deemed affected. But in some circumstances you might perform non-code changes and wish to rerun the build job. If you need to manually deem the image as affected in subsequent deployments, unset the version in the `ConfigMap` by running `devops k8s unset version <image-name>`.

The same `ConfigMap` that holds the latest deployed image version also holds the latest configured scale per app, i.e. the number of pod replicas. By using `devops scale set`, the deployment gets scaled up and the `ConfigMap` gets updated so that future deployments maintain the desired scale.
