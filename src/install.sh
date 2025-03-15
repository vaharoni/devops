#! /usr/bin/env bash

# Install the ./devops utility, allowing its lean use without installing all dependent projects

cp package.json package.json.bak
bun .devops/eject-workspaces.ts > package.json.new
mv package.json.new package.json
bun install
mv package.json.bak package.json