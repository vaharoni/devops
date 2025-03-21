FROM python:3.12-slim

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y jq libpq-dev curl git parallel --fix-missing

# Install poetry
RUN curl -sSL https://install.python-poetry.org | python3 -
ENV PATH="/root/.local/bin:${PATH}"

# We want venv so that the github action can do caching for us
RUN python -m venv venv
ENV PATH="/app/venv/bin:${PATH}"
ENV VIRTUAL_ENV="/app/venv"

# Install root dependencies using poetry
COPY poetry.lock pyproject.toml ./
RUN poetry install

COPY . .

# Install all dependencies
RUN ./devopspy poetry install

# For prisma client, if used
RUN ./devopspy run-many generate
RUN ./devopspy run-many build

# The config folder will be mounted when the pod starts with up-to-date env variables that are used in runtime by server-side code
RUN rm -rf config/

ENTRYPOINT [ "./python-run.sh" ]