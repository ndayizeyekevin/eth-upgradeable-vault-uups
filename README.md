# ETH Vault Monitoring Stack

A local DeFi development stack for an upgradeable ETH vault, a React dashboard, and Prometheus/Grafana monitoring.

## Stack

- `contracts/`: Hardhat project for the upgradeable vault
- `frontend/`: Vite + React dashboard
- `monitoring/exporter/`: Prometheus exporter for vault metrics
- `monitoring/grafana/`: Grafana dashboards and provisioning

## Docker

The Docker setup was rebuilt around a single `docker-compose.yml`.

Services:
- `hardhat-node`: local JSON-RPC chain on `http://localhost:8545`
- `contract-deployer`: deploys the vault automatically after the chain is ready
- `frontend`: Vite app on `http://localhost:3000`
- `vault-exporter`: metrics API on `http://localhost:8080`
- `prometheus`: Prometheus UI on `http://localhost:9090`
- `grafana`: Grafana UI on `http://localhost:3001` with `admin/admin`

The deployed local vault address is written to `contracts/deployment-localhost.json` and shared with the frontend and exporter at startup.

## Run

Prerequisites:
- Docker Desktop or Docker Engine with Compose
- Node.js 18+ for non-container local development

Start the full stack:

```bash
docker compose up --build -d
```

Stop and remove containers and volumes:

```bash
docker compose down -v
```

Tail logs:

```bash
docker compose logs -f
```

You can also use the root scripts:

```bash
npm run dev
npm run docker:down
npm run docker:logs
```

## Local Development Without Docker

Contracts:

```bash
cd contracts
npm install
npm run compile
npm test
npm run node
```

In another shell:

```bash
cd contracts
npm run deploy:local
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Exporter:

```bash
cd monitoring/exporter
npm install
npm start
```

## Notes

- The frontend now reads the local vault address from `VITE_LOCAL_VAULT_ADDRESS` when provided.
- The Hardhat `localhost` network now honors `LOCALHOST_RPC_URL`, which is required for container-to-container deployment.
- Sepolia settings remain in code for non-local use.
