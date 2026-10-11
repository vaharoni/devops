#!/usr/bin/env bash

# The following:
#   run.sh some-dir some-command arg1 args
# Changes the current directory to some-dir and then runs the following command before returning to the original directory:
#   some-command arg1 arg2
#
# Deprecated: kept for backward compatibility with plugins that import `execShPath`. Use the `cwd` option of
# CommandExecutor instead.

# Change to the provided directory
pushd "$1" &> /dev/null || exit

# Execute the rest of the arguments
"${@:2}"

EXIT_CODE=$?

# Return to the previous directory
popd &> /dev/null 

exit $EXIT_CODE