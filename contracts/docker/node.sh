#!/bin/sh
set -eu

if [ ! -x /app/node_modules/.bin/hardhat ]; then
  echo "Installing contract dependencies in mounted workspace"
  npm ci
fi

exec npx hardhat node --hostname 0.0.0.0
