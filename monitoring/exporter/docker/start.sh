#!/bin/sh
set -eu

deployment_file="${DEPLOYMENT_FILE:-/deployment/deployment.json}"

if [ ! -x /app/node_modules/.bin/nodemon ] && [ ! -d /app/node_modules/express ]; then
  echo "Installing exporter dependencies in mounted workspace"
  npm install
fi

until [ -f "$deployment_file" ]; do
  echo "Waiting for deployment metadata at $deployment_file"
  sleep 2
done

export VAULT_ADDRESS="${VAULT_ADDRESS:-$(node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(data.proxy);" "$deployment_file")}"

echo "Starting exporter for vault ${VAULT_ADDRESS}"
exec npm start
