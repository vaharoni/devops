# syntax=docker/dockerfile:1
# FROM node:bookworm-slim
FROM node:22.4.1-bookworm-slim

RUN apt-get update && apt-get install -y jq curl

WORKDIR /app

ENV NODE_ENV=production

ARG MONOREPO_ENV
ENV MONOREPO_ENV=${MONOREPO_ENV}
RUN echo "Building for environment: $MONOREPO_ENV"

RUN npm install -g bun

# This assumes devops prep-build was called by the host
COPY . .

# Install dependencies using bun
RUN --mount=type=cache,target=/root/.bun/install/cache bun install

# Env variables that need to be statically resolved during the build (e.g. NEXT_PUBLIC_*) are provided as a build secret
# created by devops prep-build (docker build --secret id=env,src=<build-folder>.build-env). Unlike COPY, a secret mount
# never ends up in an image layer.
# For prisma client, if used
RUN --mount=type=secret,id=env,target=/app/config/.env.global,required=true ./devops run-many generate
RUN --mount=type=secret,id=env,target=/app/config/.env.global,required=true ./devops run-many build

# The config folder is populated when the pod starts with up-to-date env variables that are used in runtime by server-side code
RUN rm -rf config/

# Pods may override this entrypoint to `node-exec.sh` using the `command` field in the pod spec.
ENTRYPOINT [ "./node-run.sh" ]
