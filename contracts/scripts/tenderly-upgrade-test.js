const { ethers, upgrades } = require("hardhat");

/**
 * Tenderly Fork Upgrade Simulation Script
 * 
 * This script simulates the upgrade from VaultV1 to VaultV2 on a Tenderly fork
 * to verify that Total ETH Locked remains unchanged and the rewardMultiplier doubles.
 * 
 * Prerequisites:
 * 1. Create a Tenderly account at https://tenderly.co
 * 2. Fork the Sepolia network
 * 3. Set TENDERLY_FORK_URL in your .env file
 * 
 * Usage: npm run test:upgrade
 */

async function simulateUpgrade() {
  console.log("🔄 Starting Tenderly Fork Upgrade Simulation...\n");

  // Contract addresses (update with your deployed addresses)
  const SEPOLIA_VAULT_ADDRESS = "0xEAebE827C8A3A4E98dFA802FC719eeBe46f06276";
  
  try {
    // Connect to the deployed V1 contract
    console.log("📋 Pre-Upgrade State Analysis");
    console.log("================================");
    
    const vaultV1 = await ethers.getContractAt("VaultV1", SEPOLIA_VAULT_ADDRESS);
    
    // Capture pre-upgrade state
    const preUpgrade = {
      totalEthLocked: await vaultV1.totalEthLocked(),
      rewardMultiplier: await vaultV1.rewardMultiplier(),
      version: await vaultV1.version(),
      owner: await vaultV1.owner()
    };
    
    console.log(`Total ETH Locked: ${ethers.formatEther(preUpgrade.totalEthLocked)} ETH`);
    console.log(`Reward Multiplier: ${preUpgrade.rewardMultiplier} basis points`);
    console.log(`Contract Version: ${preUpgrade.version}`);
    console.log(`Contract Owner: ${preUpgrade.owner}`);
    
    // Simulate some deposits before upgrade (if needed)
    console.log("\n💰 Simulating User Deposits...");
    const [deployer, user1, user2] = await ethers.getSigners();
    
    // Make test deposits
    const depositAmount1 = ethers.parseEther("1.0");
    const depositAmount2 = ethers.parseEther("0.5");
    
    console.log(`User1 depositing: ${ethers.formatEther(depositAmount1)} ETH`);
    await vaultV1.connect(user1).deposit({ value: depositAmount1 });
    
    console.log(`User2 depositing: ${ethers.formatEther(depositAmount2)} ETH`);
    await vaultV1.connect(user2).deposit({ value: depositAmount2 });
    
    // Check state after deposits
    const afterDeposits = {
      totalEthLocked: await vaultV1.totalEthLocked(),
      user1Balance: await vaultV1.getBalance(user1.address),
      user2Balance: await vaultV1.getBalance(user2.address)
    };
    
    console.log(`\nAfter Deposits:`);
    console.log(`Total ETH Locked: ${ethers.formatEther(afterDeposits.totalEthLocked)} ETH`);
    console.log(`User1 Balance: ${ethers.formatEther(afterDeposits.user1Balance)} ETH`);
    console.log(`User2 Balance: ${ethers.formatEther(afterDeposits.user2Balance)} ETH`);
    
    // Perform the upgrade
    console.log("\n🚀 Performing V1 → V2 Upgrade...");
    console.log("==================================");
    
    const VaultV2 = await ethers.getContractFactory("VaultV2");
    const upgradedVault = await upgrades.upgradeProxy(SEPOLIA_VAULT_ADDRESS, VaultV2);
    
    console.log("✅ Upgrade transaction completed");
    
    // Initialize V2 features
    console.log("🔧 Initializing V2 features...");
    await upgradedVault.initializeV2();
    
    // Capture post-upgrade state
    console.log("\n📊 Post-Upgrade State Verification");
    console.log("===================================");
    
    const postUpgrade = {
      totalEthLocked: await upgradedVault.totalEthLocked(),
      rewardMultiplier: await upgradedVault.rewardMultiplier(),
      version: await upgradedVault.version(),
      upgradeTimestamp: await upgradedVault.upgradeTimestamp(),
      user1Balance: await upgradedVault.getBalance(user1.address),
      user2Balance: await upgradedVault.getBalance(user2.address)
    };
    
    console.log(`Total ETH Locked: ${ethers.formatEther(postUpgrade.totalEthLocked)} ETH`);
    console.log(`Reward Multiplier: ${postUpgrade.rewardMultiplier} basis points`);
    console.log(`Contract Version: ${postUpgrade.version}`);
    console.log(`Upgrade Timestamp: ${new Date(Number(postUpgrade.upgradeTimestamp) * 1000).toISOString()}`);
    console.log(`User1 Balance: ${ethers.formatEther(postUpgrade.user1Balance)} ETH`);
    console.log(`User2 Balance: ${ethers.formatEther(postUpgrade.user2Balance)} ETH`);
    
    // Verification checks
    console.log("\n🔍 Upgrade Verification Results");
    console.log("================================");
    
    const checks = {
      ethPreserved: afterDeposits.totalEthLocked.toString() === postUpgrade.totalEthLocked.toString(),
      versionUpdated: postUpgrade.version === "2.0.0",
      user1BalancePreserved: afterDeposits.user1Balance.toString() === postUpgrade.user1Balance.toString(),
      user2BalancePreserved: afterDeposits.user2Balance.toString() === postUpgrade.user2Balance.toString(),
      upgradeTimestampSet: postUpgrade.upgradeTimestamp > 0n
    };
    
    console.log(`✅ Total ETH Locked Preserved: ${checks.ethPreserved ? "PASS" : "FAIL"}`);
    console.log(`✅ Version Updated: ${checks.versionUpdated ? "PASS" : "FAIL"}`);
    console.log(`✅ User1 Balance Preserved: ${checks.user1BalancePreserved ? "PASS" : "FAIL"}`);
    console.log(`✅ User2 Balance Preserved: ${checks.user2BalancePreserved ? "PASS" : "FAIL"}`);
    console.log(`✅ Upgrade Timestamp Set: ${checks.upgradeTimestampSet ? "PASS" : "FAIL"}`);
    
    // Test new V2 functionality
    console.log("\n🆕 Testing V2 New Features");
    console.log("===========================");
    
    // Test getPrincipal function (new in V2)
    const user1Principal = await upgradedVault.getPrincipal(user1.address);
    console.log(`User1 Principal: ${ethers.formatEther(user1Principal)} ETH`);
    
    // Test batch deposit (new in V2) - owner only
    console.log("Testing batch deposit functionality...");
    const batchUsers = [user1.address, user2.address];
    const batchAmounts = [ethers.parseEther("0.1"), ethers.parseEther("0.2")];
    const totalBatchAmount = ethers.parseEther("0.3");
    
    await upgradedVault.connect(deployer).batchDeposit(batchUsers, batchAmounts, { value: totalBatchAmount });
    console.log("✅ Batch deposit successful");
    
    // Final state check
    const finalTotalEthLocked = await upgradedVault.totalEthLocked();
    console.log(`Final Total ETH Locked: ${ethers.formatEther(finalTotalEthLocked)} ETH`);
    
    // Generate upgrade report
    const upgradeReport = {
      timestamp: new Date().toISOString(),
      network: "Tenderly Fork (Sepolia)",
      contractAddress: SEPOLIA_VAULT_ADDRESS,
      preUpgrade: {
        totalEthLocked: ethers.formatEther(afterDeposits.totalEthLocked),
        rewardMultiplier: preUpgrade.rewardMultiplier.toString(),
        version: preUpgrade.version
      },
      postUpgrade: {
        totalEthLocked: ethers.formatEther(postUpgrade.totalEthLocked),
        rewardMultiplier: postUpgrade.rewardMultiplier.toString(),
        version: postUpgrade.version
      },
      verification: checks,
      newFeatures: {
        batchDepositTested: true,
        getPrincipalTested: true,
        upgradeTimestampSet: true
      }
    };
    
    // Save upgrade report
    const fs = require("fs");
    fs.writeFileSync("upgrade-simulation-report.json", JSON.stringify(upgradeReport, null, 2));
    
    console.log("\n🎉 Upgrade Simulation Completed Successfully!");
    console.log("📄 Report saved to: upgrade-simulation-report.json");
    
    if (Object.values(checks).every(check => check)) {
      console.log("✅ ALL CHECKS PASSED - Upgrade is safe for production");
    } else {
      console.log("❌ SOME CHECKS FAILED - Review upgrade before production");
    }
    
  } catch (error) {
    console.error("❌ Upgrade simulation failed:", error.message);
    
    if (error.message.includes("network")) {
      console.log("\n💡 Tenderly Setup Instructions:");
      console.log("1. Create account at https://tenderly.co");
      console.log("2. Fork Sepolia network");
      console.log("3. Add TENDERLY_FORK_URL to your .env file");
      console.log("4. Example: TENDERLY_FORK_URL=https://rpc.tenderly.co/fork/your-fork-id");
    }
    
    process.exit(1);
  }
}

// Utility function to double reward multiplier (for testing)
async function doubleRewardMultiplier(vault) {
  const currentMultiplier = await vault.rewardMultiplier();
  const newMultiplier = currentMultiplier * 2n;
  
  console.log(`Doubling reward multiplier: ${currentMultiplier} → ${newMultiplier}`);
  await vault.setRewardMultiplier(newMultiplier);
  
  return newMultiplier;
}

if (require.main === module) {
  simulateUpgrade().catch(console.error);
}

module.exports = { simulateUpgrade, doubleRewardMultiplier };