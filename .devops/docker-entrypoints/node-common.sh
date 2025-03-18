check_env() {
  if [ -z "${MONOREPO_ENV}" ]; then
    echo "ERROR: MONOREPO_ENV does not exist"
    exit 1
  fi
}

setup_config() {
  mkdir -p /app/config

  if [ -f /etc/kubernetes/secrets/env_json ]; then
    jq -r 'to_entries|map("\(.key)=\(.value|tostring)")|.[]' /etc/kubernetes/secrets/env_json > /app/config/.env.global
  else
    echo "WARNING: /etc/kubernetes/secrets/env_json does not exist"
  fi
}

pause_if_no_args() {
  if [ "$1" -eq 0 ]; then
    echo "WARNING: No args provided. Pausing."
    tail -f /dev/null
  fi
}
