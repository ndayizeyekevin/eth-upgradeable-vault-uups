#!/bin/sh
set -eu

deployment_file="${DEPLOYMENT_FILE:-/deployment/deployment.json}"

if [ ! -x /app/node_modules/.bin/vite ]; then
  echo "Installing frontend dependencies in mounted workspace"
  npm ci
fi

until [ -f "$deployment_file" ]; do
  echo "Waiting for deployment metadata at $deployment_file"
  sleep 2
done

export VITE_LOCAL_VAULT_ADDRESS="$(node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(data.proxy);" "$deployment_file")"

echo "Starting frontend with local vault ${VITE_LOCAL_VAULT_ADDRESS}"
exec npm run dev -- --host 0.0.0.0 --port 3000
