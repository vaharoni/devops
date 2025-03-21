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