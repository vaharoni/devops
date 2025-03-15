#! /usr/bin/env bash

source "$(dirname "$0")/node-common.sh"

check_env
setup_config
pause_if_no_args "$#"
./devops run $1:${2:-start}
