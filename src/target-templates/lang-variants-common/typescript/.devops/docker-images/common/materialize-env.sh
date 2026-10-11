#! /usr/bin/env bash

# Entrypoint of the init container that gives the main container only the env variables its workspace declares.
# Usage: ./materialize-env.sh <workspace>

source "$(dirname "$0")/docker-common.sh"

materialize_env "$1"
