// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title VaultV1
 * @dev UUPS Upgradeable ETH Vault with deposit, withdraw, and reward calculation
 */
contract VaultV1 is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable
{
    // State variables
    uint256 public rewardMultiplier;
    uint256 public totalEthLocked;
    
    struct UserDeposit {
        uint256 amount;
        uint256 depositTimestamp;
    }
    
    mapping(address => UserDeposit) public deposits;
    
    // Events
    event Deposited(address indexed user, uint256 amount, uint256 timestamp);
    event Withdrawn(address indexed user, uint256 amount, uint256 reward, uint256 timestamp);
    event RewardMultiplierUpdated(uint256 oldMultiplier, uint256 newMultiplier);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the contract (replaces constructor for upgradeable contracts)
     * @param _rewardMultiplier Initial reward multiplier (in basis points, e.g., 100 = 1%)
     */
    function initialize(uint256 _rewardMultiplier) public initializer {
        __Ownable_init(msg.sender);
        
        rewardMultiplier = _rewardMultiplier;
        totalEthLocked = 0;
    }
    
    /**
     * @dev Deposit ETH into the vault
     */
    function deposit() external payable {
        require(msg.value > 0, "Deposit amount must be greater than 0");
        
        UserDeposit storage userDeposit = deposits[msg.sender];
        
        // If user already has a deposit, calculate and add pending rewards to principal
        if (userDeposit.amount > 0) {
            uint256 pendingReward = calculateReward(msg.sender);
            userDeposit.amount += pendingReward;
        }
        
        userDeposit.amount += msg.value;
        userDeposit.depositTimestamp = block.timestamp;
        totalEthLocked += msg.value;
        
        emit Deposited(msg.sender, msg.value, block.timestamp);
    }
    
    /**
     * @dev Withdraw ETH from the vault with rewards
     * @param amount Amount to withdraw (0 = withdraw all)
     */
    function withdraw(uint256 amount) external {
        UserDeposit storage userDeposit = deposits[msg.sender];
        require(userDeposit.amount > 0, "No deposit found");
        
        uint256 reward = calculateReward(msg.sender);
        uint256 totalAmount = userDeposit.amount + reward;
        
        uint256 withdrawAmount;
        if (amount == 0 || amount >= totalAmount) {
            // Withdraw everything
            withdrawAmount = totalAmount;
            totalEthLocked -= userDeposit.amount;
            delete deposits[msg.sender];
        } else {
            // Partial withdrawal
            require(amount <= totalAmount, "Insufficient balance");
            withdrawAmount = amount;
            
            // Deduct from principal first, then from rewards
            if (amount <= userDeposit.amount) {
                userDeposit.amount -= amount;
                totalEthLocked -= amount;
            } else {
                uint256 principalUsed = userDeposit.amount;
                totalEthLocked -= principalUsed;
                userDeposit.amount = 0;
            }
            
            userDeposit.depositTimestamp = block.timestamp;
        }
        
        require(address(this).balance >= withdrawAmount, "Insufficient contract balance");
        
        emit Withdrawn(msg.sender, withdrawAmount, reward, block.timestamp);
        
        // Transfer ETH to user
        (bool success, ) = payable(msg.sender).call{value: withdrawAmount}("");
        require(success, "ETH transfer failed");
    }
    
    /**
     * @dev Calculate reward based on deposit amount, time, and multiplier
     * @param user Address of the user
     * @return Calculated reward amount
     */
    function calculateReward(address user) public view returns (uint256) {
        UserDeposit memory userDeposit = deposits[user];
        
        if (userDeposit.amount == 0) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - userDeposit.depositTimestamp;
        
        // Reward calculation: (amount * timeElapsed * rewardMultiplier) / (365 days * 10000)
        // rewardMultiplier is in basis points (100 = 1% per year)
        uint256 reward = (userDeposit.amount * timeElapsed * rewardMultiplier) / (365 days * 10000);
        
        return reward;
    }
    
    /**
     * @dev Get user's total balance including rewards
     * @param user Address of the user
     * @return Total balance (principal + rewards)
     */
    function getBalance(address user) external view returns (uint256) {
        UserDeposit memory userDeposit = deposits[user];
        if (userDeposit.amount == 0) {
            return 0;
        }
        return userDeposit.amount + calculateReward(user);
    }
    
    /**
     * @dev Update reward multiplier (only owner)
     * @param _newMultiplier New reward multiplier in basis points
     */
    function setRewardMultiplier(uint256 _newMultiplier) external onlyOwner {
        uint256 oldMultiplier = rewardMultiplier;
        rewardMultiplier = _newMultiplier;
        emit RewardMultiplierUpdated(oldMultiplier, _newMultiplier);
    }
    
    /**
     * @dev Required by UUPS - authorize upgrade (only owner can upgrade)
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    /**
     * @dev Get contract version
     */
    function version() external pure virtual returns (string memory) {
        return "1.0.0";
    }
    
    // Receive function to accept ETH
    receive() external payable {
        revert("Use deposit() function");
    }
}
