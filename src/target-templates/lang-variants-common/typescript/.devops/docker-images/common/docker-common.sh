SECRET_ENV_JSON=/etc/kubernetes/secrets/env_json
ENV_KEYS_JSON=/app/.devops/env-keys.json
CONFIG_DIR=/app/config
CONFIG_ENV_FILE=/app/config/.env.global

check_env() {
  if [ -z "${MONOREPO_ENV}" ]; then
    echo "ERROR: MONOREPO_ENV does not exist"
    exit 1
  fi
}

# Converts a JSON object of env variables on stdin into single-quoted .env lines, which are read literally
# (no command substitution and no escape sequences other than \' and \\).
json_to_dotenv() {
  jq -r --arg q "'" 'to_entries[] | "\(.key)=\($q)\(.value | tostring | gsub("\\\\"; "\\\\") | gsub($q; "\\\($q)"))\($q)"'
}

# Containers that mount the secret (e.g. the debug console) get all env variables.
# Containers whose env was materialized by an init container (see materialize_env) do not mount the secret.
setup_config() {
  if [ -f "$SECRET_ENV_JSON" ]; then
    mkdir -p "$CONFIG_DIR"
    json_to_dotenv < "$SECRET_ENV_JSON" > "$CONFIG_ENV_FILE"
  elif [ ! -f "$CONFIG_ENV_FILE" ]; then
    echo "WARNING: neither $SECRET_ENV_JSON nor $CONFIG_ENV_FILE exist"
  fi
}

# Meant to run in an init container that mounts the secret and shares $CONFIG_DIR (an emptyDir) with the main container.
# Writes only the variables declared in the env.yaml files of the given workspace and its dependencies, as recorded in
# $ENV_KEYS_JSON by `devops prep-build`, plus MONOREPO_* variables.
materialize_env() {
  local workspace="$1"
  if [ -z "$workspace" ]; then
    echo "ERROR: materialize_env requires a workspace name"
    exit 1
  fi
  if [ ! -f "$SECRET_ENV_JSON" ]; then
    echo "ERROR: $SECRET_ENV_JSON does not exist"
    exit 1
  fi
  mkdir -p "$CONFIG_DIR"

  if [ ! -f "$ENV_KEYS_JSON" ]; then
    echo "WARNING: $ENV_KEYS_JSON does not exist. Was the image built with an older devops version? Injecting all env variables."
    json_to_dotenv < "$SECRET_ENV_JSON" > "$CONFIG_ENV_FILE"
    return
  fi

  local filtered
  filtered=$(jq --slurpfile keys "$ENV_KEYS_JSON" --arg ws "$workspace" '
    ($keys[0][$ws]) as $allowed
    | if $allowed == null then error("workspace \($ws) not found in env-keys.json") else . end
    | with_entries(select(.key as $k | ($allowed | index($k)) != null or ($k | startswith("MONOREPO_"))))
  ' "$SECRET_ENV_JSON") || exit 1
  echo "$filtered" | json_to_dotenv > "$CONFIG_ENV_FILE"
  echo "Materialized $(echo "$filtered" | jq 'length') env variables for $workspace"
}

pause_if_no_args() {
  if [ "$1" -eq 0 ]; then
    echo "WARNING: No args provided. Pausing."
    tail -f /dev/null
  fi
}
