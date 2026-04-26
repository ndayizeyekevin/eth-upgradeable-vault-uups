# 🌐 Multi-Network Deployment Guide

## Quick Fix for Your Issues

### 🔧 **Sepolia Network Issue (Transactions work but no data shows)**

**Problem**: Contract deployed to wrong address or frontend pointing to wrong contract.

**Solution**:
1. **Deploy to Sepolia properly**:
   ```bash
   cd contracts
   cp .env.example .env
   # Edit .env with your private key and RPC URL
   npm run deploy:sepolia
   ```

2. **The deployment script will automatically update the frontend config** with the correct Sepolia contract address.

### 💰 **Mainnet Insufficient Funds Issue**

**Problem**: Not enough ETH for gas fees on mainnet.

**Solutions**:
1. **Check your balance**:
   ```bash
   # The deployment script will show your balance
   npm run deploy:mainnet
   ```

2. **Get more ETH** or **use a testnet first**:
   - Mainnet requires real ETH (expensive!)
   - Use Sepolia testnet instead for testing

## 📋 Step-by-Step Network Setup

### 1. **Environment Setup**

```bash
cd contracts
cp .env.example .env
```

Edit `.env` file:
```env
PRIVATE_KEY=your_private_key_without_0x_prefix
SEPOLIA_RPC_URL=https://rpc.sepolia.org
MAINNET_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your-api-key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### 2. **Get Your Private Key**

**From MetaMask**:
1. Click account menu → Account Details
2. Export Private Key
3. Copy the key (without 0x prefix)

**⚠️ Security Warning**: Never share your private key or commit it to git!

### 3. **Get Testnet ETH (Sepolia)**

**Free Sepolia ETH Faucets**:
- https://sepoliafaucet.com/
- https://faucet.sepolia.dev/
- https://sepolia-faucet.pk910.de/

**You need**: ~0.01 ETH for deployment

### 4. **Deploy to Networks**

```bash
# Deploy to Sepolia (recommended for testing)
npm run deploy:sepolia

# Deploy to Mainnet (requires real ETH)
npm run deploy:mainnet

# Deploy to local Hardhat
npm run deploy:local
```

### 5. **Verify Deployment**

The script will:
- ✅ Check your balance
- ✅ Deploy the contract
- ✅ Verify the deployment
- ✅ Update frontend configuration
- ✅ Save deployment info

## 🔍 Troubleshooting

### **"Insufficient funds" Error**

```bash
❌ Insufficient balance for deployment!
Required: 0.01 ETH
Available: 0.005 ETH
```

**Solutions**:
1. **For Sepolia**: Get more test ETH from faucets
2. **For Mainnet**: Add more real ETH to your wallet
3. **Alternative**: Use Hardhat local network

### **"Contract not deployed" in Frontend**

```bash
⚠️ Contract Not Deployed
The vault contract is not deployed on Sepolia Testnet.
```

**Solutions**:
1. Deploy to the network: `npm run deploy:sepolia`
2. Check the contract address in deployment file
3. Verify frontend is using correct address

### **RPC URL Issues**

**Error**: `Error: could not detect network`

**Solutions**:
1. **Use public RPC URLs**:
   ```env
   SEPOLIA_RPC_URL=https://rpc.sepolia.org
   ```

2. **Or get API keys**:
   - Infura: https://infura.io/
   - Alchemy: https://alchemy.com/
   - Ankr: https://ankr.com/

### **Gas Price Too High**

**Error**: `Error: transaction underpriced`

**Solutions**:
1. **Wait for lower gas prices** (use https://ethgasstation.info/)
2. **Use Layer 2 networks** (Polygon, Arbitrum, Optimism)
3. **Deploy during off-peak hours**

## 📊 Network Information

| Network | Chain ID | Currency | Gas Cost | Best For |
|---------|----------|----------|----------|----------|
| Hardhat Local | 31337 | ETH (fake) | Free | Development |
| Sepolia | 11155111 | ETH (test) | Free | Testing |
| Mainnet | 1 | ETH (real) | $5-50+ | Production |

## 🚀 Quick Commands

```bash
# Check balances and network status
npx hardhat run scripts/deploy-multichain.js --network sepolia --dry-run

# Deploy to all networks
npm run deploy:local
npm run deploy:sepolia
# npm run deploy:mainnet  # Only when ready!

# Verify contracts on Etherscan
npm run verify:sepolia -- DEPLOYED_CONTRACT_ADDRESS
```

## 💡 Pro Tips

1. **Always test on Sepolia first** before mainnet
2. **Keep private keys secure** - use hardware wallets for mainnet
3. **Monitor gas prices** - deploy during low-traffic times
4. **Use Layer 2 solutions** for cheaper transactions
5. **Keep deployment records** - save all deployment info

## 🆘 Still Having Issues?

1. **Check the deployment logs** in `deployment-sepolia.json`
2. **Verify your wallet has enough ETH**
3. **Confirm RPC URLs are working**
4. **Try deploying to Hardhat local first**
5. **Check network status** on status pages

The new deployment script will give you detailed error messages and suggestions for fixing common issues!