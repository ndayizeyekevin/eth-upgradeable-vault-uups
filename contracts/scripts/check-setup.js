require("dotenv").config();

async function checkSetup() {
  console.log("🔍 Checking deployment setup...\n");

  // Check environment variables
  const privateKey = process.env.PRIVATE_KEY;
  const sepoliaRpc = process.env.SEPOLIA_RPC_URL;
  const mainnetRpc = process.env.MAINNET_RPC_URL;

  console.log("📋 Environment Variables:");
  console.log("PRIVATE_KEY:", privateKey ? 
    (privateKey === "your_private_key_here" ? "❌ Not set (using placeholder)" : 
     privateKey.length === 64 ? "✅ Valid length (64 chars)" : `❌ Invalid length (${privateKey.length} chars, expected 64)`) 
    : "❌ Missing");
  
  console.log("SEPOLIA_RPC_URL:", sepoliaRpc ? "✅ Set" : "❌ Missing");
  console.log("MAINNET_RPC_URL:", mainnetRpc ? "✅ Set" : "❌ Missing");

  if (!privateKey || privateKey === "your_private_key_here") {
    console.log("\n🔧 How to get your private key:");
    console.log("1. Open MetaMask");
    console.log("2. Click on your account name");
    console.log("3. Click 'Account Details'");
    console.log("4. Click 'Export Private Key'");
    console.log("5. Enter your MetaMask password");
    console.log("6. Copy the private key (without 0x prefix)");
    console.log("7. Paste it in your .env file");
    console.log("\n📝 Your .env should look like:");
    console.log("PRIVATE_KEY=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
    console.log("\n⚠️  NEVER share your private key with anyone!");
    return;
  }

  if (privateKey.length !== 64) {
    console.log("\n❌ Private key length issue:");
    console.log(`Expected: 64 characters`);
    console.log(`Got: ${privateKey.length} characters`);
    console.log("\n🔧 Common fixes:");
    console.log("- Remove '0x' prefix if present");
    console.log("- Make sure you copied the complete key");
    console.log("- Check for extra spaces or newlines");
    return;
  }

  // Test network connections
  console.log("\n🌐 Testing Network Connections:");
  
  try {
    const { ethers } = require("hardhat");
    
    // Test Sepolia
    if (sepoliaRpc) {
      try {
        const sepoliaProvider = new ethers.JsonRpcProvider(sepoliaRpc);
        const sepoliaBlock = await sepoliaProvider.getBlockNumber();
        console.log("Sepolia RPC:", `✅ Connected (block ${sepoliaBlock})`);
        
        // Check balance on Sepolia
        const wallet = new ethers.Wallet(privateKey, sepoliaProvider);
        const balance = await sepoliaProvider.getBalance(wallet.address);
        console.log("Sepolia Balance:", `${ethers.formatEther(balance)} ETH`);
        
        if (balance < ethers.parseEther("0.01")) {
          console.log("⚠️  Low Sepolia balance! Get test ETH from:");
          console.log("   - https://sepoliafaucet.com/");
          console.log("   - https://faucet.sepolia.dev/");
          console.log(`   - Send to: ${wallet.address}`);
        }
      } catch (error) {
        console.log("Sepolia RPC:", `❌ Failed (${error.message})`);
      }
    }

    console.log("\n✅ Setup check complete!");
    console.log("\n🚀 Ready to deploy? Run:");
    console.log("npm run deploy:sepolia");

  } catch (error) {
    console.error("❌ Error during setup check:", error.message);
  }
}

checkSetup().catch(console.error);