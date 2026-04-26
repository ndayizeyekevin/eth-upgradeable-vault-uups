const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Deploying VaultV1 with UUPS proxy...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Initial reward multiplier: 500 basis points = 5% APY
  const initialRewardMultiplier = 500;

  // Deploy VaultV1 with proxy
  const VaultV1 = await ethers.getContractFactory("VaultV1");
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

  console.log("VaultV1 Proxy deployed to:", vaultAddress);
  console.log("Implementation address:", await upgrades.erc1967.getImplementationAddress(vaultAddress));
  console.log("Admin address:", await upgrades.erc1967.getAdminAddress(vaultAddress));

  // Verify deployment
  const version = await vault.version();
  const rewardMultiplier = await vault.rewardMultiplier();
  console.log("Contract version:", version);
  console.log("Reward multiplier:", rewardMultiplier.toString(), "basis points");

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: "localhost",
    proxy: vaultAddress,
    implementation: await upgrades.erc1967.getImplementationAddress(vaultAddress),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    version: version,
    rewardMultiplier: rewardMultiplier.toString(),
  };

  fs.writeFileSync(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to deployment-info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
