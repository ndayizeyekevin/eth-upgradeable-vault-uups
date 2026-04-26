require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

// Validate private key
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (PRIVATE_KEY && PRIVATE_KEY !== "your_private_key_here" && PRIVATE_KEY.length !== 64) {
  console.error("❌ Invalid private key length. Expected 64 characters (32 bytes).");
  console.error("Current length:", PRIVATE_KEY.length);
  console.error("Make sure to use the private key WITHOUT the '0x' prefix.");
  process.exit(1);
}

// Use default account for local development if no private key provided
const accounts = PRIVATE_KEY && PRIVATE_KEY !== "your_private_key_here" 
  ? [PRIVATE_KEY] 
  : [];

// Multiple RPC URLs for better reliability
const SEPOLIA_RPC_URLS = [
  process.env.SEPOLIA_RPC_URL,
  "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
  "https://rpc2.sepolia.org",
  "https://sepolia.gateway.tenderly.co",
  "https://ethereum-sepolia.blockpi.network/v1/rpc/public"
].filter(Boolean);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      accounts: {
        count: 20,
        accountsBalance: "10000000000000000000000", // 10,000 ETH
      },
    },
    localhost: {
      url: process.env.LOCALHOST_RPC_URL || "http://127.0.0.1:8545",
      chainId: 31337,
    },
    sepolia: {
      url: SEPOLIA_RPC_URLS[0] || "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      accounts: accounts,
      chainId: 11155111,
      timeout: 60000, // 60 seconds
      httpHeaders: {
        "User-Agent": "hardhat"
      }
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "https://eth-mainnet.alchemyapi.io/v2/your-api-key",
      accounts: accounts,
      chainId: 1,
      timeout: 60000,
      httpHeaders: {
        "User-Agent": "hardhat"
      }
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
