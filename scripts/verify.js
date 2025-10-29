/* eslint-disable no-console */
require("dotenv").config();
const hre = require("hardhat");

// Replace with your deployed contract addresses
const NFT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS || "";
const MARKETPLACE_ADDRESS = process.env.MARKETPLACE_CONTRACT_ADDRESS || "";

async function verifyDeployment() {
  if (!NFT_ADDRESS || !MARKETPLACE_ADDRESS) {
    console.log("Please set NFT_CONTRACT_ADDRESS and MARKETPLACE_CONTRACT_ADDRESS in your .env file");
    return;
  }

  console.log("Verifying deployment...");
  console.log("Network:", hre.network.name);
  console.log("NFT Contract:", NFT_ADDRESS);
  console.log("Marketplace Contract:", MARKETPLACE_ADDRESS);

  try {
    // Get contract instances
    const nftContract = await hre.ethers.getContractAt("GamingAssetNFT", NFT_ADDRESS);
    const marketplaceContract = await hre.ethers.getContractAt("Marketplace", MARKETPLACE_ADDRESS);

    // Check NFT contract
    console.log("\n=== NFT Contract Info ===");
    const name = await nftContract.name();
    const symbol = await nftContract.symbol();
    console.log("Name:", name);
    console.log("Symbol:", symbol);
    console.log("Supports ERC721:", await nftContract.supportsInterface("0x80ac58cd"));
    console.log("Supports ERC2981:", await nftContract.supportsInterface("0x2a55205a"));

    // Check Marketplace contract
    console.log("\n=== Marketplace Contract Info ===");
    const platformFeeBps = await marketplaceContract.platformFeeBps();
    const feeRecipient = await marketplaceContract.feeRecipient();
    console.log("Platform Fee:", (Number(platformFeeBps) / 100).toFixed(2) + "%");
    console.log("Fee Recipient:", feeRecipient);

    console.log("\n✅ Deployment verification successful!");

  } catch (error) {
    console.error("❌ Deployment verification failed:", error.message);
  }
}

async function getContractInfo() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("=== Contract Deployment Info ===");
  console.log("Deployer address:", deployer.address);
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", hre.network.config.chainId);
  
  if (hre.network.name === "coreTestnet") {
    console.log("Block Explorer: https://scan.test2.btcs.network/");
  }
  
  console.log("\nTo verify deployment, update your .env file with:");
  console.log("NFT_CONTRACT_ADDRESS=0x...");
  console.log("MARKETPLACE_CONTRACT_ADDRESS=0x...");
  console.log("\nThen run: npx hardhat run scripts/verify.js --network", hre.network.name);
}

if (require.main === module) {
  if (NFT_ADDRESS && MARKETPLACE_ADDRESS) {
    verifyDeployment().catch(console.error);
  } else {
    getContractInfo().catch(console.error);
  }
}

module.exports = { verifyDeployment, getContractInfo };