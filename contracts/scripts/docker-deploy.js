const fs = require("fs");
const path = require("path");
const { ethers, upgrades } = require("hardhat");

async function main() {
  const outputDir = process.env.DEPLOYMENT_OUTPUT_DIR || "/deployment";
  const outputFile = path.join(outputDir, "deployment.json");

  const [deployer] = await ethers.getSigners();
  const VaultV1 = await ethers.getContractFactory("VaultV1");
  const vault = await upgrades.deployProxy(VaultV1, [100], {
    initializer: "initialize",
    kind: "uups",
  });

  await vault.waitForDeployment();

  const proxy = await vault.getAddress();
  const implementation = await upgrades.erc1967.getImplementationAddress(proxy);
  const deployment = {
    network: "localhost",
    chainId: 31337,
    proxy,
    implementation,
    deployer: deployer.address,
    blockNumber: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(deployment, null, 2));
  fs.writeFileSync("deployment-localhost.json", JSON.stringify(deployment, null, 2));

  console.log(`Deployment written to ${outputFile}`);
  console.log(`Vault proxy: ${proxy}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
