# Preqreuisites

Install Poetry by following [the docs](https://python-poetry.org/docs/#installing-with-the-official-installer), e.g.:
```shell
curl -sSL https://install.python-poetry.org | python3 -
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
