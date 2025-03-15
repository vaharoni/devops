#!/usr/bin/env bash

# The following:
#   run.sh some-dir some-command arg1 args
# Changes the current directory to some-dir and then runs the following command before returning to the original directory:
#   some-command arg1 arg2
#
# We need this until this Nx issue is fixed:
#   https://github.com/nrwl/nx/issues/22994
# 
# We cannot use `cwd` in exec or spawn since dotenvx won't inject the env variables properly

# Change to the provided directory
pushd "$1" &> /dev/null || exit

# Execute the rest of the arguments
"${@:2}"

EXIT_CODE=$?

# Return to the previous directory
popd &> /dev/null 

exit $EXIT_CODE