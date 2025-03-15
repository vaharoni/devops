# FROM node:bookworm-slim
FROM node:22.4.1-bookworm-slim

RUN apt-get update && apt-get install -y jq curl

WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g bun

# This assumes devops prep-build was called by the host, which creates the config/ folder with necessary env variables
# that are needed to be statitcally resolved by devops run-many build (e.g. NEXT_PUBLIC_*)
COPY . .

# Install dependencies using bun
# Mount the GH_PAT_TOKEN secret and use it during bun install
RUN --mount=type=secret,id=GH_PAT_TOKEN \
  GH_PAT_TOKEN=$(cat /run/secrets/GH_PAT_TOKEN) && \
  bun install

ENV PATH="/app/node_modules/.bin:$PATH"

RUN devops run-many build

# The config folder will be mounted when the pod starts with up-to-date env variables that are used in runtime by server-side code
RUN rm -rf config/

# Pods may override this entrypoint to `node-exec.sh` using the `command` field in the pod spec.
ENTRYPOINT [ ".devops/docker-entrypoints/node-run.sh" ]
