# syntax=docker/dockerfile:1
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV UV_SYSTEM_PYTHON=1
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app

ARG MONOREPO_ENV
ENV MONOREPO_ENV=${MONOREPO_ENV}
RUN echo "Building for environment: $MONOREPO_ENV"

# Install dependencies
RUN apt-get update && apt-get install -y jq libpq-dev curl git parallel --fix-missing

# Copy project files
COPY . .

RUN \
  --mount=type=cache,target=/root/.cache/uv \
  uv sync --all-packages --all-extras

# Env variables needed during the build are provided as a build secret created by devops prep-build
# (docker build --secret id=env,src=<build-folder>.build-env). Unlike COPY, a secret mount never ends up in an image layer.
# For prisma client, if used
RUN --mount=type=secret,id=env,target=/app/config/.env.global,required=true ./devopspy run-many generate
RUN --mount=type=secret,id=env,target=/app/config/.env.global,required=true ./devopspy run-many build

# The config folder is populated when the pod starts with up-to-date env variables that are used in runtime by server-side code
RUN rm -rf config/

ENTRYPOINT [ "./python-run.sh" ]