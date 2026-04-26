const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Upgrading VaultV1 to VaultV2...");

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);

  // Read deployment info
  const fs = require("fs");
  let deploymentInfo;
  try {
    deploymentInfo = JSON.parse(fs.readFileSync("deployment-info.json", "utf8"));
  } catch (error) {
    console.error("Could not read deployment-info.json. Please deploy first.");
    process.exit(1);
  }

  const proxyAddress = deploymentInfo.proxy;
  console.log("Proxy address:", proxyAddress);

  // Get current state before upgrade
  const vaultV1 = await ethers.getContractAt("VaultV1", proxyAddress);
  const totalEthBefore = await vaultV1.totalEthLocked();
  const rewardMultiplierBefore = await vaultV1.rewardMultiplier();
  console.log("Total ETH locked before upgrade:", ethers.formatEther(totalEthBefore));
  console.log("Reward multiplier before upgrade:", rewardMultiplierBefore.toString());

  // Deploy VaultV2
  const VaultV2 = await ethers.getContractFactory("VaultV2");
  const upgradedVault = await upgrades.upgradeProxy(proxyAddress, VaultV2);

  await upgradedVault.waitForDeployment();

  // Initialize V2 features
  console.log("Initializing V2 features...");
  const initTx = await upgradedVault.initializeV2();
  await initTx.wait();

  // Verify upgrade
  const version = await upgradedVault.version();
  const totalEthAfter = await upgradedVault.totalEthLocked();
  const rewardMultiplierAfter = await upgradedVault.rewardMultiplier();
  const upgradeTimestamp = await upgradedVault.upgradeTimestamp();

  console.log("\n=== Upgrade Verification ===");
  console.log("New version:", version);
  console.log("Total ETH locked after upgrade:", ethers.formatEther(totalEthAfter));
  console.log("Reward multiplier after upgrade:", rewardMultiplierAfter.toString());
  console.log("Upgrade timestamp:", new Date(Number(upgradeTimestamp) * 1000).toISOString());

  // Verify state preservation
  const statePreserved = totalEthBefore.toString() === totalEthAfter.toString();
  console.log("State preserved:", statePreserved ? "✅ YES" : "❌ NO");

  if (!statePreserved) {
    console.error("ERROR: State was not preserved during upgrade!");
    process.exit(1);
  }

  // Update deployment info
  deploymentInfo.version = version;
  deploymentInfo.upgradeTimestamp = new Date().toISOString();
  deploymentInfo.implementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  fs.writeFileSync(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n✅ Upgrade completed successfully!");
  console.log("Updated deployment info saved to deployment-info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });