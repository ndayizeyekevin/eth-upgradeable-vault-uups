const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🚀 Deploying VaultV1 to local Hardhat network...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  
  try {
    // Get the contract factory
    const VaultV1 = await ethers.getContractFactory("VaultV1");
    
    console.log("📦 Deploying proxy and implementation...");
    
    // Deploy the upgradeable proxy
    const vault = await upgrades.deployProxy(VaultV1, [100], { // 100 basis points = 1% annual reward
      initializer: "initialize",
      kind: "uups"
    });
    
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    
    console.log("✅ VaultV1 deployed successfully!");
    console.log("📍 Proxy address:", vaultAddress);
    
    // Get implementation address
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(vaultAddress);
    console.log("📍 Implementation address:", implementationAddress);
    
    // Save deployment info
    const deploymentInfo = {
      network: "localhost",
      chainId: 31337,
      proxy: vaultAddress,
      implementation: implementationAddress,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      blockNumber: await ethers.provider.getBlockNumber()
    };
    
    const fs = require('fs');
    fs.writeFileSync(
      'deployment-localhost.json', 
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log("💾 Deployment info saved to deployment-localhost.json");
    
    // Verify the deployment
    console.log("🔍 Verifying deployment...");
    const rewardMultiplier = await vault.rewardMultiplier();
    console.log("Reward multiplier:", rewardMultiplier.toString());
    
    console.log("🎉 Deployment completed successfully!");
    console.log("🔗 You can now interact with the vault at:", vaultAddress);
    
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });