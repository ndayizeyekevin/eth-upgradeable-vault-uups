#!/bin/sh
set -eu

output_dir="${DEPLOYMENT_OUTPUT_DIR:-/deployment}"
mkdir -p "$output_dir"

if [ ! -x /app/node_modules/.bin/hardhat ]; then
  echo "Installing contract dependencies in mounted workspace"
  npm ci
fi

echo "Waiting for Hardhat RPC at ${LOCALHOST_RPC_URL:-http://hardhat-node:8545}"
until node -e "fetch(process.env.LOCALHOST_RPC_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',method:'eth_chainId',params:[],id:1})}).then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"; do
  sleep 2
done

rm -f "$output_dir/deployment.json"
npx hardhat run scripts/docker-deploy.js --network localhost
