const { ethers } = require("ethers");

const SEPOLIA_RPC_URLS = [
  "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
  "https://rpc2.sepolia.org", 
  "https://sepolia.gateway.tenderly.co",
  "https://ethereum-sepolia.blockpi.network/v1/rpc/public",
  "https://rpc.sepolia.org",
  "https://sepolia-rpc.scroll.io/",
  "https://sepolia.drpc.org"
];

async function testRpcUrl(url, timeout = 10000) {
  try {
    console.log(`Testing: ${url}`);
    
    const provider = new ethers.JsonRpcProvider(url);
    
    // Set a timeout for the request
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );
    
    const blockPromise = provider.getBlockNumber();
    const block = await Promise.race([blockPromise, timeoutPromise]);
    
    const responseTime = Date.now();
    console.log(`✅ ${url} - Block: ${block} (Fast)`);
    return { url, block, success: true, responseTime };
    
  } catch (error) {
    console.log(`❌ ${url} - Error: ${error.message}`);
    return { url, success: false, error: error.message };
  }
}

async function findBestRpc() {
  console.log("🔍 Testing Sepolia RPC endpoints...\n");
  
  const results = [];
  
  // Test all URLs in parallel with shorter timeout
  const promises = SEPOLIA_RPC_URLS.map(url => testRpcUrl(url, 5000));
  const testResults = await Promise.allSettled(promises);
  
  testResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      results.push({ 
        url: SEPOLIA_RPC_URLS[index], 
        success: false, 
        error: result.reason.message 
      });
    }
  });
  
  const workingRpcs = results.filter(r => r.success);
  
  console.log("\n📊 Results:");
  console.log(`Working RPCs: ${workingRpcs.length}/${SEPOLIA_RPC_URLS.length}`);
  
  if (workingRpcs.length > 0) {
    console.log("\n✅ Recommended RPC URLs (fastest first):");
    workingRpcs
      .sort((a, b) => a.responseTime - b.responseTime)
      .forEach((rpc, index) => {
        console.log(`${index + 1}. ${rpc.url}`);
      });
    
    const bestRpc = workingRpcs[0];
    console.log(`\n🚀 Best RPC: ${bestRpc.url}`);
    console.log("\n📝 Update your .env file:");
    console.log(`SEPOLIA_RPC_URL=${bestRpc.url}`);
    
    return bestRpc.url;
  } else {
    console.log("\n❌ No working RPC endpoints found!");
    console.log("\n🔧 Possible solutions:");
    console.log("1. Check your internet connection");
    console.log("2. Try again later (RPC endpoints may be temporarily down)");
    console.log("3. Get a free API key from:");
    console.log("   - Infura: https://infura.io/");
    console.log("   - Alchemy: https://alchemy.com/");
    console.log("   - Ankr: https://ankr.com/");
    
    return null;
  }
}

if (require.main === module) {
  findBestRpc().catch(console.error);
}

module.exports = { findBestRpc, testRpcUrl };