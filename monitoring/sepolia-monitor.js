const { ethers } = require('ethers');

// Sepolia configuration
const SEPOLIA_RPC = 'https://sepolia.gateway.tenderly.co';
const VAULT_ADDRESS = '0xEAebE827C8A3A4E98dFA802FC719eeBe46f06276';

// Vault ABI for monitoring
const VAULT_ABI = [
  "function totalEthLocked() view returns (uint256)",
  "function rewardMultiplier() view returns (uint256)",
  "function version() view returns (string)",
  "function getBalance(address) view returns (uint256)",
  "function deposits(address) view returns (uint256 amount, uint256 depositTimestamp)",
  "event Deposited(address indexed user, uint256 amount, uint256 timestamp)",
  "event Withdrawn(address indexed user, uint256 amount, uint256 reward, uint256 timestamp)"
];

class VaultMonitor {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    this.vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, this.provider);
    this.metrics = {
      totalEthLocked: 0,
      transactionSuccessRate: 1,
      totalDepositors: new Set(),
      totalTransactions: 0,
      successfulTransactions: 0,
      rewardMultiplier: 0,
      version: '1.0.0',
      lastUpdate: new Date()
    };
    
    this.startMonitoring();
  }

  async startMonitoring() {
    console.log('🚀 Starting Sepolia Vault Monitor...');
    console.log(`📋 Vault Address: ${VAULT_ADDRESS}`);
    console.log(`🌐 RPC: ${SEPOLIA_RPC}`);
    
    try {
      // Initial data collection
      await this.collectCurrentMetrics();
      await this.collectHistoricalData();
      
      // Set up real-time event listeners
      this.setupEventListeners();
      
      // Start periodic updates
      setInterval(() => this.collectCurrentMetrics(), 30000); // Every 30 seconds
      setInterval(() => this.displayMetrics(), 10000); // Display every 10 seconds
      
      console.log('✅ Monitor started successfully!\n');
      this.displayMetrics();
      
    } catch (error) {
      console.error('❌ Failed to start monitor:', error.message);
    }
  }

  async collectCurrentMetrics() {
    try {
      const [totalEth, multiplier, version, blockNumber] = await Promise.all([
        this.vault.totalEthLocked(),
        this.vault.rewardMultiplier(),
        this.vault.version(),
        this.provider.getBlockNumber()
      ]);

      this.metrics.totalEthLocked = parseFloat(ethers.formatEther(totalEth));
      this.metrics.rewardMultiplier = Number(multiplier);
      this.metrics.version = version;
      this.metrics.blockNumber = blockNumber;
      this.metrics.lastUpdate = new Date();
      
    } catch (error) {
      console.error('⚠️  Error collecting metrics:', error.message);
    }
  }

  async collectHistoricalData() {
    try {
      console.log('📚 Collecting historical transaction data...');
      
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000); // Last 50k blocks
      
      // Get deposit events
      const depositFilter = this.vault.filters.Deposited();
      const depositEvents = await this.vault.queryFilter(depositFilter, fromBlock, currentBlock);
      
      // Get withdrawal events  
      const withdrawFilter = this.vault.filters.Withdrawn();
      const withdrawEvents = await this.vault.queryFilter(withdrawFilter, fromBlock, currentBlock);
      
      // Process events
      depositEvents.forEach(event => {
        this.metrics.totalDepositors.add(event.args.user.toLowerCase());
        this.metrics.totalTransactions++;
        this.metrics.successfulTransactions++;
      });
      
      withdrawEvents.forEach(event => {
        this.metrics.totalTransactions++;
        this.metrics.successfulTransactions++;
      });
      
      this.updateSuccessRate();
      
      console.log(`📈 Found ${depositEvents.length} deposits and ${withdrawEvents.length} withdrawals`);
      
    } catch (error) {
      console.error('⚠️  Error collecting historical data:', error.message);
    }
  }

  setupEventListeners() {
    console.log('👂 Setting up real-time event listeners...');
    
    // Listen for new deposits
    this.vault.on('Deposited', (user, amount, timestamp, event) => {
      const ethAmount = parseFloat(ethers.formatEther(amount));
      console.log(`\n📥 NEW DEPOSIT!`);
      console.log(`   User: ${user}`);
      console.log(`   Amount: ${ethAmount.toFixed(4)} ETH`);
      console.log(`   Block: ${event.blockNumber}`);
      console.log(`   Tx: ${event.transactionHash}`);
      
      this.metrics.totalDepositors.add(user.toLowerCase());
      this.metrics.totalTransactions++;
      this.metrics.successfulTransactions++;
      this.updateSuccessRate();
      
      // Trigger immediate metrics update
      this.collectCurrentMetrics();
    });

    // Listen for withdrawals
    this.vault.on('Withdrawn', (user, amount, reward, timestamp, event) => {
      const ethAmount = parseFloat(ethers.formatEther(amount));
      const rewardAmount = parseFloat(ethers.formatEther(reward));
      
      console.log(`\n📤 NEW WITHDRAWAL!`);
      console.log(`   User: ${user}`);
      console.log(`   Amount: ${ethAmount.toFixed(4)} ETH`);
      console.log(`   Reward: ${rewardAmount.toFixed(6)} ETH`);
      console.log(`   Block: ${event.blockNumber}`);
      console.log(`   Tx: ${event.transactionHash}`);
      
      this.metrics.totalTransactions++;
      this.metrics.successfulTransactions++;
      this.updateSuccessRate();
      
      // Trigger immediate metrics update
      this.collectCurrentMetrics();
    });
  }

  updateSuccessRate() {
    this.metrics.transactionSuccessRate = this.metrics.totalTransactions > 0 
      ? this.metrics.successfulTransactions / this.metrics.totalTransactions 
      : 1;
  }

  displayMetrics() {
    console.clear();
    console.log('🏦 ETH VAULT REAL-TIME MONITORING DASHBOARD');
    console.log('='.repeat(60));
    console.log(`📊 Last Updated: ${this.metrics.lastUpdate.toLocaleString()}`);
    console.log(`🔗 Block Number: ${this.metrics.blockNumber || 'N/A'}`);
    console.log('');
    
    // Key Metrics
    console.log('💰 TOTAL ETH LOCKED');
    console.log(`   ${this.metrics.totalEthLocked.toFixed(4)} ETH`);
    console.log('');
    
    console.log('✅ TRANSACTION SUCCESS RATE');
    console.log(`   ${(this.metrics.transactionSuccessRate * 100).toFixed(2)}%`);
    console.log('');
    
    console.log('👥 TOTAL DEPOSITORS');
    console.log(`   ${this.metrics.totalDepositors.size} unique users`);
    console.log('');
    
    console.log('💎 CURRENT APY');
    console.log(`   ${(this.metrics.rewardMultiplier / 100).toFixed(2)}% (${this.metrics.rewardMultiplier} basis points)`);
    console.log('');
    
    console.log('📈 TRANSACTION STATS');
    console.log(`   Total: ${this.metrics.totalTransactions}`);
    console.log(`   Successful: ${this.metrics.successfulTransactions}`);
    console.log(`   Success Rate: ${(this.metrics.transactionSuccessRate * 100).toFixed(2)}%`);
    console.log('');
    
    console.log('🔧 CONTRACT INFO');
    console.log(`   Version: ${this.metrics.version}`);
    console.log(`   Address: ${VAULT_ADDRESS}`);
    console.log(`   Network: Sepolia Testnet`);
    console.log('');
    
    console.log('🔗 LINKS');
    console.log(`   Etherscan: https://sepolia.etherscan.io/address/${VAULT_ADDRESS}`);
    console.log(`   Frontend: http://localhost:3001`);
    console.log('');
    console.log('⚡ Listening for real-time events...');
  }

  // Export metrics in Prometheus format
  getPrometheusMetrics() {
    return `
# HELP vault_total_eth_locked Total ETH locked in vault
# TYPE vault_total_eth_locked gauge
vault_total_eth_locked ${this.metrics.totalEthLocked}

# HELP vault_transaction_success_rate Transaction success rate
# TYPE vault_transaction_success_rate gauge
vault_transaction_success_rate ${this.metrics.transactionSuccessRate}

# HELP vault_total_depositors Total number of depositors
# TYPE vault_total_depositors gauge
vault_total_depositors ${this.metrics.totalDepositors.size}

# HELP vault_reward_multiplier Reward multiplier in basis points
# TYPE vault_reward_multiplier gauge
vault_reward_multiplier ${this.metrics.rewardMultiplier}

# HELP vault_transactions_total Total transactions
# TYPE vault_transactions_total counter
vault_transactions_total ${this.metrics.totalTransactions}
    `.trim();
  }
}

// Start monitoring
const monitor = new VaultMonitor();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n📴 Shutting down monitor...');
  process.exit(0);
});

module.exports = VaultMonitor;