FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV UV_SYSTEM_PYTHON=1
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y jq libpq-dev curl git parallel --fix-missing

# Copy project files
COPY . .

RUN \
  --mount=type=cache,target=/root/.cache/uv \
  uv sync --all-packages --all-extras

# For prisma client, if used
RUN ./devopspy run-many generate
RUN ./devopspy run-many build

# The config folder will be mounted when the pod starts with up-to-date env variables that are used in runtime by server-side code
RUN rm -rf config/

ENTRYPOINT [ "./python-run.sh" ]