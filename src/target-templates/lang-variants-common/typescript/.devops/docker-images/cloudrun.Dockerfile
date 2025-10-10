FROM node:24-bookworm-slim AS builder

RUN apt-get update && apt-get install -y jq curl

WORKDIR /app

ENV NODE_ENV=production

ARG MONOREPO_ENV
ENV MONOREPO_ENV=${MONOREPO_ENV}
RUN echo "Building for environment: $MONOREPO_ENV"

RUN npm install -g bun

# This assumes devops prep-build was called by the host, which creates the config/ folder with necessary env variables
# that are needed to be statitcally resolved by devops run-many build (e.g. NEXT_PUBLIC_*)
COPY . .

# Install dependencies using bun
RUN --mount=type=cache,target=/root/.bun/install/cache bun install

# This assumes the image has only one application that has a build script which outputs to dist/
RUN ./devops run-many build


FROM gcr.io/distroless/nodejs24-debian12 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["dist/index.js"]