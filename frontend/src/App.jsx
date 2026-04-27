import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import VaultDashboard from './components/VaultDashboard'
import './App.css'

const features = [
  {
    title: 'Upgradeable Vault',
    body: 'UUPS-based contract flow for iterative development and controlled upgrades.',
  },
  {
    title: 'Live Monitoring',
    body: 'Prometheus and Grafana expose vault state, RPC health, and contract activity.',
  },
  {
    title: 'Local and Sepolia',
    body: 'The interface supports local Hardhat development and the deployed Sepolia contract.',
  },
]

const environments = [
  ['Frontend', 'localhost:3000'],
  ['Hardhat RPC', 'localhost:8545'],
  ['Exporter', 'localhost:8080'],
  ['Prometheus', 'localhost:9090'],
  ['Grafana', 'localhost:3002'],
]

function App() {
  const { isConnected } = useAccount()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">Ethereum Operations</p>
          <h1>Vault Control Surface</h1>
        </div>
        <div className="topbar-actions">
          <span className="status-chip">{isConnected ? 'Wallet connected' : 'Wallet required'}</span>
          <ConnectButton />
        </div>
      </header>

      <main className="page-content">
        {isConnected ? (
          <VaultDashboard />
        ) : (
          <section className="landing-grid">
            <div className="hero-panel">
              <p className="section-label">Local monitoring stack</p>
              <h2>Run the vault like an operator, not a demo page.</h2>
              <p className="hero-copy">
                This frontend is wired for contract interaction, live vault telemetry, and local chain iteration.
                Connect a wallet to work with deposits, withdrawals, and state inspection from one surface.
              </p>
              <div className="environment-panel">
                {environments.map(([label, value]) => (
                  <div className="environment-row" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="feature-rail">
              {features.map((feature) => (
                <article className="feature-panel" key={feature.title}>
                  <p className="section-label">Capability</p>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
