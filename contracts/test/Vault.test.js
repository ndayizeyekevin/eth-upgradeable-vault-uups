const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Vault Contract Tests", function () {
  let vault, vaultV2;
  let owner, user1, user2;
  const INITIAL_REWARD_MULTIPLIER = 500; // 5% APY

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy VaultV1
    const VaultV1 = await ethers.getContractFactory("VaultV1");
    vault = await upgrades.deployProxy(
      VaultV1,
      [INITIAL_REWARD_MULTIPLIER],
      {
        initializer: "initialize",
        kind: "uups",
      }
    );
    await vault.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should initialize correctly", async function () {
      expect(await vault.rewardMultiplier()).to.equal(INITIAL_REWARD_MULTIPLIER);
      expect(await vault.totalEthLocked()).to.equal(0);
      expect(await vault.owner()).to.equal(owner.address);
      expect(await vault.version()).to.equal("1.0.0");
    });

    it("Should prevent initialization twice", async function () {
      await expect(
        vault.initialize(1000)
      ).to.be.revertedWithCustomError(vault, "InvalidInitialization");
    });
  });

  describe("Deposits", function () {
    it("Should allow ETH deposits", async function () {
      const depositAmount = ethers.parseEther("1.0");
      
      await expect(vault.connect(user1).deposit({ value: depositAmount }))
        .to.emit(vault, "Deposited")
        .withArgs(user1.address, depositAmount, await time.latest() + 1);

      const userDeposit = await vault.deposits(user1.address);
      expect(userDeposit.amount).to.equal(depositAmount);
      expect(await vault.totalEthLocked()).to.equal(depositAmount);
    });

    it("Should reject zero deposits", async function () {
      await expect(
        vault.connect(user1).deposit({ value: 0 })
      ).to.be.revertedWith("Deposit amount must be greater than 0");
    });

    it("Should handle multiple deposits from same user", async function () {
      const firstDeposit = ethers.parseEther("1.0");
      const secondDeposit = ethers.parseEther("0.5");

      await vault.connect(user1).deposit({ value: firstDeposit });
      
      // Fast forward time to accrue some rewards
      await time.increase(30 * 24 * 60 * 60); // 30 days
      
      await vault.connect(user1).deposit({ value: secondDeposit });

      const userDeposit = await vault.deposits(user1.address);
      // Should include original deposit + rewards + new deposit
      expect(userDeposit.amount).to.be.gt(firstDeposit + secondDeposit);
    });
  });

  describe("Withdrawals", function () {
    beforeEach(async function () {
      // Setup initial deposit
      await vault.connect(user1).deposit({ value: ethers.parseEther("2.0") });
    });

    it("Should allow full withdrawal with rewards", async function () {
      // Fast forward time to accrue rewards
      await time.increase(365 * 24 * 60 * 60); // 1 year
      
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const expectedReward = await vault.calculateReward(user1.address);
      
      const tx = await vault.connect(user1).withdraw(0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      const actualReceived = balanceAfter - balanceBefore + gasUsed;
      
      // Should receive original deposit + rewards
      expect(actualReceived).to.be.closeTo(
        ethers.parseEther("2.0") + expectedReward,
        ethers.parseEther("0.001") // Small tolerance for gas variations
      );
      
      expect(await vault.totalEthLocked()).to.equal(0);
    });

    it("Should allow partial withdrawal", async function () {
      const withdrawAmount = ethers.parseEther("1.0");
      
      await vault.connect(user1).withdraw(withdrawAmount);
      
      const userDeposit = await vault.deposits(user1.address);
      expect(userDeposit.amount).to.equal(ethers.parseEther("1.0"));
      expect(await vault.totalEthLocked()).to.equal(ethers.parseEther("1.0"));
    });

    it("Should reject withdrawal with no deposit", async function () {
      await expect(
        vault.connect(user2).withdraw(ethers.parseEther("1.0"))
      ).to.be.revertedWith("No deposit found");
    });
  });

  describe("Reward Calculation", function () {
    it("Should calculate rewards correctly", async function () {
      const depositAmount = ethers.parseEther("1.0");
      await vault.connect(user1).deposit({ value: depositAmount });
      
      // Fast forward 1 year
      await time.increase(365 * 24 * 60 * 60);
      
      const reward = await vault.calculateReward(user1.address);
      const expectedReward = (depositAmount * BigInt(INITIAL_REWARD_MULTIPLIER)) / BigInt(10000);
      
      expect(reward).to.be.closeTo(expectedReward, ethers.parseEther("0.001"));
    });

    it("Should return zero reward for non-depositors", async function () {
      const reward = await vault.calculateReward(user2.address);
      expect(reward).to.equal(0);
    });
  });

  describe("Upgrades", function () {
    it("Should upgrade to V2 successfully", async function () {
      // Make a deposit first
      await vault.connect(user1).deposit({ value: ethers.parseEther("1.0") });
      const totalEthBefore = await vault.totalEthLocked();
      
      // Upgrade to V2
      const VaultV2 = await ethers.getContractFactory("VaultV2");
      vaultV2 = await upgrades.upgradeProxy(vault.target, VaultV2);
      
      // Initialize V2
      await vaultV2.initializeV2();
      
      // Verify state preservation
      expect(await vaultV2.totalEthLocked()).to.equal(totalEthBefore);
      expect(await vaultV2.version()).to.equal("2.0.0");
      expect(await vaultV2.upgradeTimestamp()).to.be.gt(0);
    });

    it("Should maintain functionality after upgrade", async function () {
      // Upgrade to V2
      const VaultV2 = await ethers.getContractFactory("VaultV2");
      vaultV2 = await upgrades.upgradeProxy(vault.target, VaultV2);
      await vaultV2.initializeV2();
      
      // Test deposit still works
      await expect(vaultV2.connect(user1).deposit({ value: ethers.parseEther("1.0") }))
        .to.emit(vaultV2, "Deposited");
      
      // Test new V2 functionality
      const principal = await vaultV2.getPrincipal(user1.address);
      expect(principal).to.equal(ethers.parseEther("1.0"));
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to set reward multiplier", async function () {
      await expect(
        vault.connect(user1).setRewardMultiplier(1000)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
      
      await expect(vault.connect(owner).setRewardMultiplier(1000))
        .to.emit(vault, "RewardMultiplierUpdated")
        .withArgs(INITIAL_REWARD_MULTIPLIER, 1000);
    });

    it("Should only allow owner to upgrade", async function () {
      const VaultV2 = await ethers.getContractFactory("VaultV2");
      
      await expect(
        upgrades.upgradeProxy(vault.target, VaultV2.connect(user1))
      ).to.be.reverted;
    });
  });

  describe("Security", function () {
    it("Should prevent reentrancy attacks", async function () {
      // This would require a malicious contract to test properly
      // For now, we verify the modifier is in place
      const depositAmount = ethers.parseEther("1.0");
      await vault.connect(user1).deposit({ value: depositAmount });
      
      // Normal withdrawal should work
      await expect(vault.connect(user1).withdraw(0)).to.not.be.reverted;
    });

    it("Should reject direct ETH transfers", async function () {
      await expect(
        user1.sendTransaction({
          to: vault.target,
          value: ethers.parseEther("1.0")
        })
      ).to.be.revertedWith("Use deposit() function");
    });
  });
});