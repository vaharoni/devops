# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS builder

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

# Env variables that need to be statically resolved during the build are provided as a build secret created by
# devops prep-build (docker build --secret id=env,src=<build-folder>.build-env). It never ends up in an image layer.
# This assumes the image has only one application that has a build script which outputs to dist/
RUN --mount=type=secret,id=env,target=/app/config/.env.global,required=true ./devops run-many build


FROM gcr.io/distroless/nodejs24-debian12 AS runner
WORKDIR /app
ENV NODE_ENV=production
ARG MONOREPO_ENV
ENV MONOREPO_ENV=${MONOREPO_ENV}
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["dist/index.js"]