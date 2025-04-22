# Prerequisites

Install uv by following [the docs](https://docs.astral.sh/uv/getting-started/installation/), e.g:
```shell
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Install GNU parallel by running `brew install parallel` and running the following to suppress the citation output:
```shell
mkdir ~/.parallel
touch ~/.parallel/will-cite
```

# Image configuration

The `./devops/config/images.yaml` defines a list of docker images that are built as part of the deployment process. Each image entry has a `language` key. Set it to `python` for python images in order for the `./devops prep-build` command to look at the python dependency graph as it considers which libraries it needs to copy over.

# Project configuration

The monorepo uses `uv` as the python tool of choice for managing dependencies. It has features similar to `bun`, such as support for workspaces and scripts. After running `bunx devops init`, a `pyproject.toml` file was created under the root folder that declares a dependency on `devops-python` using a `tool.uv` directive. It also utilizes uv's workspace support and points to example workspaces that were created when running `bunx devops init`.

To add a new workspace using `uv`, run something like the following:
```shell
uv init applications/app1
uv init libs/lib1
```
This creates the appropriate folder structures under `applications` and `libs` and add their paths under the `tool.uv.workspace.members` key in the root `pyproject.toml` file, e.g.:
```toml
[tool.uv.workspace]
members = ["applications/app1", "libs/lib1"]
```

To make your application depend on a lib inside the monorepo, run:
```shell
uv --package app1 add lib1
```

This adds `lib1` as a `project.dependencies` entry in the `pyproject.toml` file of `app1`, as well as an entry under `tool.uv.sources` to mark `lib1` with `workspace = true`, e.g.:
```toml
# applications/app1/pyproject.toml
[project]
name = "app1"
# ...
dependencies = ["lib1"]

[tool.uv.sources]
lib1 = { workspace = true }
```

In order for the lib to be accessible by apps, a build-system must be declared in the `pyproject.toml` file of the lib. This is unnecssary for applications, as no other project depends on them. But for libs it is required:
```toml
# libs/lib1/pyproject.toml

# ...

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

To add scripts in a workspace that can be run using `./devopspy run` and `./devopspy run-many`, add them to `pyproject.toml` like so (the scripts can be any valid shell command):
```toml
[tool.devops.scripts]
dev = "python -c 'from src.example_python.scripts import dev; dev()'"
start = "python -c 'from src.example_python.scripts import start; start()'"
```

This custom solution is preferred since the two alternative solutions are lacking. Putting them under `project.scripts` per the `pyproject.toml` [specs](https://packaging.python.org/en/latest/overview/) requires their project to have a build system and their name to be globally unique. On the other hand, using the uv-special script support described [here](https://docs.astral.sh/uv/guides/scripts/) does not allow them to be recognized by name to be triggered by `./devopspy run` and `./devopspy run-many`. 

# Usage

To install all workspace dependencies:
```shell
uv sync --all-packages --all-extras
```
The `--all-packages` flag installs the dependencies of all workspace members. The `--all-extras` flag installs the dependencies that come with packages with extras, such as "standard" in `fastapi[standard]`.

The `./devops` tool must be aware of all python projects and their dependency graph in order to be able to perform build-related tasks such as `prep-build`. However, it is unable to run python scripts declared in `pyproject.toml` files. The `./devopspy` tool is designed for this purpose. It supports a small subset of the commands of the `./devops` tool - most importantly `exec`, `run`, and `run-many`. Run `./devopspy -h` to see all available options. Not that the tool is a bit more sensitive to flag location compared to the `./devops` tool. 

In python-based docker images, only `./devopspy` is available.

# Example pyproject.toml file

```toml
[project]
name = "my-project"
version = "0.1.0"
description = ""
authors = []
requires-python = ">=3.12"
dependencies = ["example-python-lib", "fastapi[standard]"]

[tool.devops.scripts]
dev = "python -c 'from src.example_python.scripts import dev; dev()'"
start = "python -c 'from src.example_python.scripts import start; start()'"

[tool.uv.sources]
example-python-lib = { workspace = true }

[tool.devops.deployment]
template = "external-service"
service_name = "example-python"
port = 3002
```