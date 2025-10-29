/* eslint-disable no-console */
require("dotenv").config();
const hre = require("hardhat");

// Replace these with your deployed contract addresses
const NFT_ADDRESS = "0x..."; // Replace with deployed GamingAssetNFT address
const MARKETPLACE_ADDRESS = "0x..."; // Replace with deployed Marketplace address

async function main() {
  const [owner, seller, buyer] = await hre.ethers.getSigners();
  
  console.log("Interacting with Gaming Asset Marketplace...");
  console.log("Owner:", owner.address);
  console.log("Seller:", seller.address);
  console.log("Buyer:", buyer.address);

  // Get contract instances
  const nftContract = await hre.ethers.getContractAt("GamingAssetNFT", NFT_ADDRESS);
  const marketplaceContract = await hre.ethers.getContractAt("Marketplace", MARKETPLACE_ADDRESS);

  try {
    // Example 1: Mint a gaming asset
    console.log("\n1. Minting gaming asset...");
    const mintTx = await nftContract.mintAsset(
      seller.address,
      "https://example.com/metadata/legendary-sword.json",
      seller.address, // royalty recipient
      500 // 5% royalty
    );
    const mintReceipt = await mintTx.wait();
    console.log("Asset minted! Transaction:", mintReceipt.hash);

    // Example 2: Approve marketplace
    console.log("\n2. Approving marketplace...");
    const approveTx = await nftContract.connect(seller).approve(MARKETPLACE_ADDRESS, 1);
    await approveTx.wait();
    console.log("Marketplace approved for token ID 1");

    // Example 3: Create a listing
    console.log("\n3. Creating marketplace listing...");
    const price = hre.ethers.parseEther("1.0");
    const listTx = await marketplaceContract.connect(seller).createListing(
      NFT_ADDRESS,
      1,
      price
    );
    const listReceipt = await listTx.wait();
    console.log("Listing created! Transaction:", listReceipt.hash);

    // Example 4: Check listing details
    console.log("\n4. Checking listing details...");
    const listing = await marketplaceContract.listings(1);
    console.log("Listing details:", {
      seller: listing.seller,
      price: hre.ethers.formatEther(listing.price),
      active: listing.active
    });

    // Example 5: Purchase the asset
    console.log("\n5. Purchasing asset...");
    const buyTx = await marketplaceContract.connect(buyer).buy(1, { value: price });
    const buyReceipt = await buyTx.wait();
    console.log("Asset purchased! Transaction:", buyReceipt.hash);

    // Example 6: Verify ownership transfer
    console.log("\n6. Verifying ownership transfer...");
    const newOwner = await nftContract.ownerOf(1);
    console.log("New owner of token ID 1:", newOwner);
    console.log("Transfer successful:", newOwner === buyer.address);

  } catch (error) {
    console.error("Error during interaction:", error.message);
  }
}

// Alternative: Create an auction example
async function createAuctionExample() {
  const [owner, seller] = await hre.ethers.getSigners();
  
  const nftContract = await hre.ethers.getContractAt("GamingAssetNFT", NFT_ADDRESS);
  const marketplaceContract = await hre.ethers.getContractAt("Marketplace", MARKETPLACE_ADDRESS);

  try {
    // Mint and approve
    await nftContract.mintAsset(seller.address, "test-uri", seller.address, 500);
    await nftContract.connect(seller).approve(MARKETPLACE_ADDRESS, 2);

    // Create auction
    const reservePrice = hre.ethers.parseEther("0.5");
    const duration = 3600; // 1 hour
    
    const auctionTx = await marketplaceContract.connect(seller).createAuction(
      NFT_ADDRESS,
      2,
      reservePrice,
      duration
    );
    
    console.log("Auction created! Transaction:", (await auctionTx.wait()).hash);
    
    // Check auction details
    const auction = await marketplaceContract.auctions(1);
    console.log("Auction details:", {
      seller: auction.seller,
      reservePrice: hre.ethers.formatEther(auction.reservePrice),
      endTime: new Date(Number(auction.endTime) * 1000).toLocaleString()
    });

  } catch (error) {
    console.error("Error creating auction:", error.message);
  }
}

// Run the main interaction
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { main, createAuctionExample };