To setup the uv project, run the following in the monorepo root folder:
```shell
uv init
```
This creates a `pyproject.toml` file in the root folder.

To utilize uv's workspace support and add a workspace, run something like the following:
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

To add scripts in a workspace that can be run using `./devopspy run` and `./devopspy run-many`, add them to `pyproject.toml` like so (the scripts can be any valid shell command):
```toml
[tool.devops.scripts]
dev = "python -c 'from src.example_python.scripts import dev; dev()'"
start = "python -c 'from src.example_python.scripts import start; start()'"
```

This custom solution is preferred since the two alternative solutions are lacking. Putting them under `project.scripts` per the `pyproject.toml` [specs](https://packaging.python.org/en/latest/overview/) requires their project to have a build system and their name to be globally unique. On the other hand, using the uv-special script support described [here](https://docs.astral.sh/uv/guides/scripts/) does not allow them to be recognized by name to be triggered by `./devopspy run` and `./devopspy run-many`. 
You can then invoke it by running `uv run scripts.py dev`




The uv tool has a workspace approach that is similar to npm workspaces. The main `pyproject.toml` has a `tool.uv.workspace.members` key that defines the paths to all workspaces. These paths can use glob patterns. However, all folders expressed by these patterns must contain `pyproject.toml` file otherwise uv refuses to run. Since many applications and libs in the monorepo can be written in typescript, this approach doesn't work. Therefore, workspaces should be added to the `members` key using their explicit folder. This doesn't need to be done manually. After Simply run, for example, `uv init some-app-name` inside `applications` and if the root folder has a `pypr

maually by using However, an interesting quirk is that if a folder 


# Preqreuisites

Install Poetry by following [the docs](https://python-poetry.org/docs/#installing-with-the-official-installer), e.g.:
```shell
curl -sSL https://install.python-poetry.org | python3 -
```

Install GNU parallel by running `brew install parallel` and running the following to suppress the citation output:
```shell
mkdir ~/.parallel
touch ~/.parallel/will-cite
```

Make sure your gitignore contains the following:
```text
```

When running `poetry new` or `poetry init`, a `pyproject.toml` file is create that looks like this:

```toml
[project]
name = "proj-name"
version = "0.1.0"
description = ""
authors = [{name = "<name>",email = "<email>"}]
readme = "README.md"
requires-python = ">=3.12"
dependencies = []

[tool.poetry]
packages = [{include = "proj_name", from = "src"}]


[build-system]
requires = ["poetry-core>=2.0.0,<3.0.0"]
build-backend = "poetry.core.masonry.api"
```


```toml
[tool.poetry.dependencies]
pyappsupport = { path = "../../.devops/pyappsupport", develop = true }
```


```toml
[tool.poetry.dependencies]
kuku = { path = "libs/greeter-test", develop = true }

[tool.poetry.scripts]
foo = "devops_test.exec:foo"
goo = "devops_test.exec:goo"

[tool.devops.deployment]
template = "test-template"
app_name = "test-app"
service_name = "test-service"
port = 3001
subdomain = "subdomain"

[[tool.devops.deployment.cronJobs]]
name = "test-cron-job-1"
cron = "*/1 * * * *"
curl = ["-X", "POST", "http://localhost:3001/test-cron-job-1"]

[[tool.devops.deployment.cronJobs]]
name = "test-cron-job-2"
cron = "*/2 * * * *"
curl = ["-X", "POST", "http://localhost:3001/test-cron-job-2"]
```