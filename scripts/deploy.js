/* eslint-disable no-console */
require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();

  const NFT_NAME = process.env.NFT_NAME || "Gaming Asset NFT";
  const NFT_SYMBOL = process.env.NFT_SYMBOL || "GANFT";
  const PLATFORM_FEE_BPS = process.env.PLATFORM_FEE_BPS || "250"; // 2.5%
  const CONFIRMATIONS = Number(process.env.CONFIRMATIONS || (network === "hardhat" ? 1 : 5));

  console.log(`Deploying Gaming Asset Marketplace to ${network} with deployer ${deployer.address} ...`);

  // Deploy the NFT contract first
  console.log("Deploying GamingAssetNFT...");
  const NFTFactory = await hre.ethers.getContractFactory("GamingAssetNFT");
  const nftContract = await NFTFactory.deploy(NFT_NAME, NFT_SYMBOL);
  await nftContract.waitForDeployment();
  const nftAddress = await nftContract.getAddress();
  
  console.log(`GamingAssetNFT deployed at: ${nftAddress}`);

  // Deploy the Marketplace contract
  console.log("Deploying Marketplace...");
  const MarketplaceFactory = await hre.ethers.getContractFactory("Marketplace");
  const marketplaceContract = await MarketplaceFactory.deploy(deployer.address, PLATFORM_FEE_BPS);
  await marketplaceContract.waitForDeployment();
  const marketplaceAddress = await marketplaceContract.getAddress();

  console.log(`Marketplace deployed at: ${marketplaceAddress}`);
  console.log(`Platform fee: ${PLATFORM_FEE_BPS} basis points (${PLATFORM_FEE_BPS/100}%)`);
  console.log(`Fee recipient: ${deployer.address}`);
  
  console.log(`Awaiting ${CONFIRMATIONS} block confirmations...`);
  await nftContract.deploymentTransaction().wait(CONFIRMATIONS);
  await marketplaceContract.deploymentTransaction().wait(CONFIRMATIONS);

  // Optional: mint initial gaming assets
  const MINT_INITIAL_ASSETS = process.env.MINT_INITIAL_ASSETS === "true";
  if (MINT_INITIAL_ASSETS) {
    console.log("Minting initial gaming assets...");
    
    const assets = [
      {
        to: deployer.address,
        tokenURI: "https://example.com/metadata/sword1.json",
        name: "Legendary Sword"
      },
      {
        to: deployer.address,
        tokenURI: "https://example.com/metadata/armor1.json", 
        name: "Dragon Scale Armor"
      },
      {
        to: deployer.address,
        tokenURI: "https://example.com/metadata/potion1.json",
        name: "Health Potion"
      }
    ];

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      console.log(`Minting ${asset.name}...`);
      const tx = await nftContract.mintAsset(
        asset.to,
        asset.tokenURI,
        deployer.address, // royalty receiver
        "500" // 5% royalty
      );
      const receipt = await tx.wait();
      console.log(`${asset.name} minted with transaction: ${receipt.hash}`);
    }
  }

  // Optional: Etherscan/Polygonscan verification
  if (process.env.ETHERSCAN_API_KEY || process.env.POLYGONSCAN_API_KEY) {
    try {
      console.log("Verifying NFT contract...");
      await hre.run("verify:verify", {
        address: nftAddress,
        constructorArguments: [NFT_NAME, NFT_SYMBOL],
      });
      
      console.log("Verifying Marketplace contract...");
      await hre.run("verify:verify", {
        address: marketplaceAddress,
        constructorArguments: [deployer.address, PLATFORM_FEE_BPS],
      });
      console.log("Verification successful.");
    } catch (err) {
      const msg = `${err}`;
      if (msg.includes("Already Verified")) {
        console.log("Already verified.");
      } else {
        console.warn("Verification skipped/failed:", msg);
      }
    }
  }

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log(`Network: ${network}`);
  console.log(`GamingAssetNFT: ${nftAddress}`);
  console.log(`Marketplace: ${marketplaceAddress}`);
  console.log(`Platform Fee: ${PLATFORM_FEE_BPS/100}%`);
  console.log(`Fee Recipient: ${deployer.address}`);
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
