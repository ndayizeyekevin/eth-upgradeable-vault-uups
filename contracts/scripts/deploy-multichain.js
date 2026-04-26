const { ethers, upgrades, network } = require("hardhat");

async function main() {
  console.log(`Deploying VaultV1 to ${network.name}...`);

  // Check if we have accounts configured
  const accounts = await ethers.getSigners();
  if (accounts.length === 0) {
    console.error("❌ No accounts configured for this network!");
    console.error("\n🔧 To fix this:");
    console.error("1. Get your private key from MetaMask:");
    console.error("   - Click your account → Account Details → Export Private Key");
    console.error("2. Edit the .env file:");
    console.error("   - Replace 'your_private_key_here' with your actual private key");
    console.error("   - Remove the '0x' prefix if present");
    console.error("   - The key should be exactly 64 characters long");
    console.error("\n📝 Example .env file:");
    console.error("PRIVATE_KEY=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
    console.error("\n⚠️  SECURITY WARNING: Never share your private key or commit it to git!");
    process.exit(1);
  }

  const [deployer] = accounts;
  console.log("Deploying with account:", deployer.address);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  
  // Check if we have enough balance for deployment
  const minBalance = ethers.parseEther("0.01"); // Minimum 0.01 ETH
  if (balance < minBalance) {
    console.error("❌ Insufficient balance for deployment!");
    console.error(`Required: ${ethers.formatEther(minBalance)} ETH`);
    console.error(`Available: ${ethers.formatEther(balance)} ETH`);
    
    if (network.name === "sepolia") {
      console.log("\n💡 To get Sepolia ETH:");
      console.log("1. Visit: https://sepoliafaucet.com/");
      console.log("2. Or: https://faucet.sepolia.dev/");
      console.log("3. Enter your address:", deployer.address);
    } else if (network.name === "mainnet") {
      console.log("\n💡 For mainnet deployment, you need real ETH");
      console.log("Consider using a testnet first!");
    }
    
    process.exit(1);
  }

  // Initial reward multiplier: 500 basis points = 5% APY
  const initialRewardMultiplier = 500;

  try {
    // Deploy VaultV1 with proxy
    const VaultV1 = await ethers.getContractFactory("VaultV1");
    
    console.log("Deploying proxy and implementation...");
    const vault = await upgrades.deployProxy(
      VaultV1,
      [initialRewardMultiplier],
      {
        initializer: "initialize",
        kind: "uups",
      }
    );

    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();

    console.log("✅ VaultV1 Proxy deployed to:", vaultAddress);
    
    // Get implementation and admin addresses
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(vaultAddress);
    const adminAddress = await upgrades.erc1967.getAdminAddress(vaultAddress);
    
    console.log("Implementation address:", implementationAddress);
    console.log("Admin address:", adminAddress);

    // Verify deployment
    const version = await vault.version();
    const rewardMultiplier = await vault.rewardMultiplier();
    const owner = await vault.owner();
    
    console.log("\n📊 Deployment Verification:");
    console.log("Contract version:", version);
    console.log("Reward multiplier:", rewardMultiplier.toString(), "basis points");
    console.log("Contract owner:", owner);
    console.log("Deployer address:", deployer.address);
    console.log("Owner matches deployer:", owner.toLowerCase() === deployer.address.toLowerCase());

    // Save deployment info
    const fs = require("fs");
    const deploymentInfo = {
      network: network.name,
      chainId: network.config.chainId || "unknown",
      proxy: vaultAddress,
      implementation: implementationAddress,
      admin: adminAddress,
      deployer: deployer.address,
      owner: owner,
      timestamp: new Date().toISOString(),
      version: version,
      rewardMultiplier: rewardMultiplier.toString(),
      blockNumber: await ethers.provider.getBlockNumber(),
    };

    const filename = `deployment-${network.name}.json`;
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    
    console.log(`\n💾 Deployment info saved to ${filename}`);
    
    // Update frontend configuration
    updateFrontendConfig(network.config.chainId || 31337, vaultAddress);
    
    console.log("\n🎉 Deployment completed successfully!");
    
    if (network.name !== "hardhat") {
      console.log("\n🔍 Verify on Etherscan:");
      console.log(`https://${network.name === "mainnet" ? "" : network.name + "."}etherscan.io/address/${vaultAddress}`);
    }
    
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    
    if (error.message.includes("insufficient funds")) {
      console.log("\n💡 This error usually means:");
      console.log("1. Not enough ETH for gas fees");
      console.log("2. Gas price is too high");
      console.log("3. Network congestion");
      
      if (network.name === "mainnet") {
        console.log("\n💰 Current gas prices are high on mainnet.");
        console.log("Consider deploying during off-peak hours or using a Layer 2 solution.");
      }
    }
    
    process.exit(1);
  }
}

function updateFrontendConfig(chainId, contractAddress) {
  try {
    const fs = require("fs");
    const path = require("path");
    
    const frontendConfigPath = path.join(__dirname, "../../frontend/src/contracts/VaultABI.js");
    
    if (fs.existsSync(frontendConfigPath)) {
      let config = fs.readFileSync(frontendConfigPath, "utf8");
      
      // Update the contract address for this chain
      const chainIdStr = chainId.toString();
      const addressPattern = new RegExp(`${chainIdStr}: '[^']*'`);
      
      if (config.includes(`${chainIdStr}:`)) {
        config = config.replace(addressPattern, `${chainIdStr}: '${contractAddress}'`);
      } else {
        // Add new chain if not exists
        const addressesPattern = /const VAULT_ADDRESSES = \{([^}]*)\}/;
        const match = config.match(addressesPattern);
        if (match) {
          const newAddresses = match[1] + `\n  ${chainIdStr}: '${contractAddress}', // ${getNetworkName(chainId)}`;
          config = config.replace(addressesPattern, `const VAULT_ADDRESSES = {${newAddresses}}`);
        }
      }
      
      fs.writeFileSync(frontendConfigPath, config);
      console.log(`✅ Updated frontend config for chain ${chainId}`);
    }
  } catch (error) {
    console.log("⚠️  Could not update frontend config:", error.message);
  }
}

function getNetworkName(chainId) {
  switch (chainId) {
    case 1: return "Mainnet";
    case 11155111: return "Sepolia";
    case 31337: return "Hardhat";
    default: return `Chain ${chainId}`;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });