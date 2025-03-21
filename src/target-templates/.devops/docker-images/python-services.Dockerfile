FROM python:3.12-slim

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y jq libpq-dev curl git parallel --fix-missing

# Install poetry
RUN curl -sSL https://install.python-poetry.org | python3 -
ENV PATH="/root/.local/bin:${PATH}"

# Configure Poetry to not use virtual environments
RUN poetry config virtualenvs.create false

# Copy project files
COPY . .

# Use the cached Poetry dependencies if available
ENV POETRY_CACHE_DIR="/app/.poetry-cache"

# Install the devopspy tool
RUN poetry install

# Install all dependencies
RUN ./devopspy poetry install

# For prisma client, if used
RUN ./devopspy run-many generate
RUN ./devopspy run-many build

# The config folder will be mounted when the pod starts with up-to-date env variables that are used in runtime by server-side code
RUN rm -rf config/

ENTRYPOINT [ "./python-run.sh" ]