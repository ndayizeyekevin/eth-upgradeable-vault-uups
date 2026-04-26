const express = require('express');
const client = require('prom-client');
const { ethers } = require('ethers');
const cron = require('node-cron');

const app = express();
const port = process.env.PORT || 8080;

// Prometheus metrics registry
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics for ETH Vault
const totalEthLocked = new client.Gauge({
  name: 'vault_total_eth_locked',
  help: 'Total ETH locked in the vault contract (real-time)',
  registers: [register]
});

const rewardMultiplier = new client.Gauge({
  name: 'vault_reward_multiplier',
  help: 'Current reward multiplier (APY in basis points)',
  registers: [register]
});

const totalDepositors = new client.Gauge({
  name: 'vault_total_depositors',
  help: 'Total number of unique depositors',
  registers: [register]
});

const transactionCount = new client.Counter({
  name: 'vault_transactions_total',
  help: 'Total number of vault transactions',
  labelNames: ['type', 'status'], // 'deposit'/'withdraw' and 'success'/'failed'
  registers: [register]
});

const transactionSuccessRate = new client.Gauge({
  name: 'vault_transaction_success_rate',
  help: 'Success rate of vault transactions (0-1)',
  registers: [register]
});

const blockNumber = new client.Gauge({
  name: 'ethereum_block_number',
  help: 'Current Ethereum block number',
  registers: [register]
});

const contractVersion = new client.Gauge({
  name: 'vault_contract_version',
  help: 'Vault contract version',
  labelNames: ['version'],
  registers: [register]
});

const avgDepositSize = new client.Gauge({
  name: 'vault_avg_deposit_size',
  help: 'Average deposit size in ETH',
  registers: [register]
});

const totalRewardsDistributed = new client.Gauge({
  name: 'vault_total_rewards_distributed',
  help: 'Total rewards distributed to users',
  registers: [register]
});

const vaultUtilization = new client.Gauge({
  name: 'vault_utilization_rate',
  help: 'Vault utilization rate (deposits vs capacity)',
  registers: [register]
});

// Contract configuration
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const VAULT_ADDRESS = process.env.VAULT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const METRICS_INTERVAL = process.env.METRICS_INTERVAL || 10; // seconds

// Vault ABI (minimal for metrics)
const VAULT_ABI = [
  "function totalEthLocked() view returns (uint256)",
  "function rewardMultiplier() view returns (uint256)",
  "function version() view returns (string)",
  "function getBalance(address) view returns (uint256)",
  "function deposits(address) view returns (uint256 amount, uint256 depositTimestamp)",
  "event Deposited(address indexed user, uint256 amount, uint256 timestamp)",
  "event Withdrawn(address indexed user, uint256 amount, uint256 reward, uint256 timestamp)"
];

let provider;
let vaultContract;
let depositorsSet = new Set();
let totalTransactions = 0;
let successfulTransactions = 0;
let totalDepositsValue = 0n;
let totalWithdrawalsValue = 0n;
let totalRewards = 0n;

// Initialize blockchain connection
async function initializeBlockchain() {
  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
    
    console.log('🔗 Connected to blockchain:', RPC_URL);
    console.log('📋 Vault contract:', VAULT_ADDRESS);
    
    // Test connection
    const network = await provider.getNetwork();
    console.log('🌐 Network:', network.name, 'Chain ID:', network.chainId.toString());
    
    // Set up event listeners
    setupEventListeners();
    
    // Initial metrics collection
    await collectMetrics();
    
    console.log('✅ Metrics exporter initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize blockchain connection:', error.message);
    
    // Set default values for offline mode
    totalEthLocked.set(0);
    rewardMultiplier.set(500); // Default 5%
    totalDepositors.set(0);
    transactionSuccessRate.set(1);
    blockNumber.set(0);
    
    console.log('⚠️  Running in offline mode with default values');
  }
}

// Set up event listeners for real-time metrics
function setupEventListeners() {
  try {
    // Listen for deposit events
    vaultContract.on('Deposited', (user, amount, timestamp, event) => {
      console.log(`📥 Deposit: ${user} deposited ${ethers.formatEther(amount)} ETH`);
      
      depositorsSet.add(user.toLowerCase());
      totalTransactions++;
      successfulTransactions++;
      totalDepositsValue += amount;
      
      transactionCount.labels('deposit', 'success').inc();
      totalDepositors.set(depositorsSet.size);
      updateSuccessRate();
      updateAverageDepositSize();
      
      // Trigger immediate metrics update
      collectMetrics().catch(console.error);
    });

    // Listen for withdrawal events
    vaultContract.on('Withdrawn', (user, amount, reward, timestamp, event) => {
      console.log(`📤 Withdrawal: ${user} withdrew ${ethers.formatEther(amount)} ETH with ${ethers.formatEther(reward)} ETH reward`);
      
      totalTransactions++;
      successfulTransactions++;
      totalWithdrawalsValue += amount;
      totalRewards += reward;
      
      transactionCount.labels('withdraw', 'success').inc();
      totalRewardsDistributed.set(parseFloat(ethers.formatEther(totalRewards)));
      updateSuccessRate();
      
      // Trigger immediate metrics update
      collectMetrics().catch(console.error);
    });
    
    console.log('👂 Event listeners set up successfully');
    
  } catch (error) {
    console.error('⚠️  Could not set up event listeners:', error.message);
  }
}

// Update transaction success rate
function updateSuccessRate() {
  const rate = totalTransactions > 0 ? successfulTransactions / totalTransactions : 1;
  transactionSuccessRate.set(rate);
}

// Update average deposit size
function updateAverageDepositSize() {
  if (depositorsSet.size > 0) {
    const avgSize = parseFloat(ethers.formatEther(totalDepositsValue)) / depositorsSet.size;
    avgDepositSize.set(avgSize);
  }
}

// Collect metrics from the blockchain
async function collectMetrics() {
  try {
    if (!provider || !vaultContract) {
      console.log('⚠️  Blockchain not connected, skipping metrics collection');
      return;
    }
    
    // Get current block number
    const currentBlock = await provider.getBlockNumber();
    blockNumber.set(currentBlock);
    
    // Get vault metrics
    const [totalEth, multiplier, version] = await Promise.all([
      vaultContract.totalEthLocked().catch(() => 0n),
      vaultContract.rewardMultiplier().catch(() => 500n),
      vaultContract.version().catch(() => "1.0.0")
    ]);
    
    // Update metrics
    totalEthLocked.set(parseFloat(ethers.formatEther(totalEth)));
    rewardMultiplier.set(Number(multiplier));
    totalDepositors.set(depositorsSet.size);
    
    // Set version label
    contractVersion.labels(version).set(1);
    
    // Calculate utilization rate (assuming max capacity of 1000 ETH for demo)
    const maxCapacity = 1000;
    const currentUtilization = parseFloat(ethers.formatEther(totalEth)) / maxCapacity;
    vaultUtilization.set(Math.min(currentUtilization, 1));
    
    console.log(`📊 Metrics updated - Block: ${currentBlock}, ETH: ${ethers.formatEther(totalEth)}, Users: ${depositorsSet.size}`);
    
  } catch (error) {
    console.error('❌ Error collecting metrics:', error.message);
    
    // Increment failed transaction counter
    transactionCount.labels('system', 'failed').inc();
  }
}

// Historical data collection (for initial setup)
async function collectHistoricalData() {
  try {
    if (!provider || !vaultContract) {
      console.log('⚠️  Blockchain not connected, skipping historical data collection');
      return;
    }
    
    console.log('📚 Collecting historical data...');
    
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000); // Last 10k blocks
    
    // Get historical deposit events
    const depositFilter = vaultContract.filters.Deposited();
    const depositEvents = await vaultContract.queryFilter(depositFilter, fromBlock, currentBlock);
    
    // Get historical withdrawal events
    const withdrawFilter = vaultContract.filters.Withdrawn();
    const withdrawEvents = await vaultContract.queryFilter(withdrawFilter, fromBlock, currentBlock);
    
    // Process events
    depositEvents.forEach(event => {
      depositorsSet.add(event.args.user.toLowerCase());
      transactionCount.labels('deposit', 'success').inc();
      totalDepositsValue += event.args.amount;
    });
    
    withdrawEvents.forEach(event => {
      transactionCount.labels('withdraw', 'success').inc();
      totalWithdrawalsValue += event.args.amount;
      totalRewards += event.args.reward;
    });
    
    totalTransactions = depositEvents.length + withdrawEvents.length;
    successfulTransactions = totalTransactions; // Assume all historical events were successful
    
    updateSuccessRate();
    updateAverageDepositSize();
    totalRewardsDistributed.set(parseFloat(ethers.formatEther(totalRewards)));
    
    console.log(`📈 Historical data collected - ${depositEvents.length} deposits, ${withdrawEvents.length} withdrawals`);
    
  } catch (error) {
    console.error('❌ Error collecting historical data:', error.message);
  }
}

// Express routes
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    console.error('❌ Error generating metrics:', error.message);
    res.status(500).end(error.message);
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    vault_address: VAULT_ADDRESS,
    rpc_url: RPC_URL,
    connected: !!provider,
    metrics_interval: METRICS_INTERVAL
  });
});

app.get('/stats', async (req, res) => {
  try {
    const stats = {
      timestamp: new Date().toISOString(),
      vault_address: VAULT_ADDRESS,
      rpc_url: RPC_URL,
      connected: !!provider
    };
    
    if (provider && vaultContract) {
      const currentBlock = await provider.getBlockNumber();
      const totalEth = await vaultContract.totalEthLocked().catch(() => 0n);
      const multiplier = await vaultContract.rewardMultiplier().catch(() => 500n);
      const version = await vaultContract.version().catch(() => "1.0.0");
      
      Object.assign(stats, {
        block_number: currentBlock,
        total_eth_locked: ethers.formatEther(totalEth),
        reward_multiplier: Number(multiplier),
        apy_percentage: Number(multiplier) / 100,
        total_depositors: depositorsSet.size,
        total_transactions: totalTransactions,
        success_rate: totalTransactions > 0 ? successfulTransactions / totalTransactions : 1,
        contract_version: version,
        avg_deposit_size: depositorsSet.size > 0 ? parseFloat(ethers.formatEther(totalDepositsValue)) / depositorsSet.size : 0,
        total_rewards_distributed: parseFloat(ethers.formatEther(totalRewards)),
        utilization_rate: Math.min(parseFloat(ethers.formatEther(totalEth)) / 1000, 1)
      });
    }
    
    res.json(stats);
  } catch (error) {
    console.error('❌ Error generating stats:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Real-time metrics endpoint
app.get('/realtime', async (req, res) => {
  try {
    const realtime = {
      timestamp: new Date().toISOString(),
      total_eth_locked: parseFloat(await register.getSingleMetric('vault_total_eth_locked').get().values[0]?.value || 0),
      transaction_success_rate: parseFloat(await register.getSingleMetric('vault_transaction_success_rate').get().values[0]?.value || 1),
      total_depositors: parseFloat(await register.getSingleMetric('vault_total_depositors').get().values[0]?.value || 0),
      current_apy: parseFloat(await register.getSingleMetric('vault_reward_multiplier').get().values[0]?.value || 500) / 100,
      block_number: parseFloat(await register.getSingleMetric('ethereum_block_number').get().values[0]?.value || 0)
    };
    
    res.json(realtime);
  } catch (error) {
    console.error('❌ Error generating realtime data:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Schedule periodic metrics collection
const intervalSeconds = parseInt(METRICS_INTERVAL);
cron.schedule(`*/${intervalSeconds} * * * * *`, collectMetrics); // Every N seconds

console.log(`⏰ Scheduled metrics collection every ${intervalSeconds} seconds`);

// Start server
async function start() {
  await initializeBlockchain();
  await collectHistoricalData();
  
  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Vault metrics exporter listening on port ${port}`);
    console.log(`📊 Metrics endpoint: http://localhost:${port}/metrics`);
    console.log(`❤️  Health endpoint: http://localhost:${port}/health`);
    console.log(`📈 Stats endpoint: http://localhost:${port}/stats`);
    console.log(`⚡ Realtime endpoint: http://localhost:${port}/realtime`);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 Received SIGINT, shutting down gracefully');
  process.exit(0);
});

start().catch(console.error);