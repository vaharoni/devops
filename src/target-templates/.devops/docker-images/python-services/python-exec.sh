#! /usr/bin/env bash

source "$(dirname "$0")/docker-common.sh"

check_env
setup_config
pause_if_no_args "$#"
"$@"
