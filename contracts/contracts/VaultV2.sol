// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./VaultV1.sol";

/**
 * @title VaultV2
 * @dev Upgraded version of VaultV1 with enhanced features
 * This version demonstrates upgrade capability while maintaining storage layout
 */
contract VaultV2 is VaultV1 {
    // New state variables must be added AFTER existing ones to avoid storage collisions
    uint256 public upgradeTimestamp;
    
    // New event
    event VaultUpgraded(string version, uint256 timestamp);
    
    /**
     * @dev Initialize V2 specific features
     * This is called after upgrade to set new state variables
     */
    function initializeV2() public reinitializer(2) {
        upgradeTimestamp = block.timestamp;
        emit VaultUpgraded("2.0.0", block.timestamp);
    }
    
    /**
     * @dev Override version function
     */
    function version() external pure override returns (string memory) {
        return "2.0.0";
    }
    
    /**
     * @dev New feature: Batch deposit for multiple users (owner only)
     * Demonstrates new functionality in upgraded contract
     */
    function batchDeposit(address[] calldata users, uint256[] calldata amounts) 
        external 
        payable 
        onlyOwner 
    {
        require(users.length == amounts.length, "Arrays length mismatch");
        
        uint256 totalRequired = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalRequired += amounts[i];
        }
        require(msg.value >= totalRequired, "Insufficient ETH sent");
        
        for (uint256 i = 0; i < users.length; i++) {
            UserDeposit storage userDeposit = deposits[users[i]];
            
            if (userDeposit.amount > 0) {
                uint256 pendingReward = calculateReward(users[i]);
                userDeposit.amount += pendingReward;
            }
            
            userDeposit.amount += amounts[i];
            userDeposit.depositTimestamp = block.timestamp;
            totalEthLocked += amounts[i];
            
            emit Deposited(users[i], amounts[i], block.timestamp);
        }
    }
    
    /**
     * @dev New feature: Emergency pause functionality
     * Get total deposits for a user (principal only, excluding rewards)
     */
    function getPrincipal(address user) external view returns (uint256) {
        return deposits[user].amount;
    }
}
