const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Gaming Asset Marketplace", function () {
  let nftContract, marketplaceContract;
  let owner, seller, buyer, feeRecipient;
  let nftAddress, marketplaceAddress;

  beforeEach(async function () {
    [owner, seller, buyer, feeRecipient] = await ethers.getSigners();

    // Deploy NFT contract
    const NFTFactory = await ethers.getContractFactory("GamingAssetNFT");
    nftContract = await NFTFactory.deploy("Gaming Asset NFT", "GANFT");
    await nftContract.waitForDeployment();
    nftAddress = await nftContract.getAddress();

    // Deploy Marketplace contract
    const MarketplaceFactory = await ethers.getContractFactory("Marketplace");
    marketplaceContract = await MarketplaceFactory.deploy(feeRecipient.address, 250); // 2.5% fee
    await marketplaceContract.waitForDeployment();
    marketplaceAddress = await marketplaceContract.getAddress();
  });

  describe("NFT Contract", function () {
    it("Should mint gaming assets correctly", async function () {
      const tokenURI = "https://example.com/metadata/sword1.json";
      
      await expect(
        nftContract.mintAsset(seller.address, tokenURI, seller.address, 500)
      ).to.emit(nftContract, "AssetMinted")
        .withArgs(seller.address, 1, tokenURI, seller.address, 500);

      expect(await nftContract.ownerOf(1)).to.equal(seller.address);
      expect(await nftContract.tokenURI(1)).to.equal(tokenURI);
    });

    it("Should handle royalties correctly", async function () {
      await nftContract.mintAsset(seller.address, "test-uri", seller.address, 500);
      
      const [receiver, royaltyAmount] = await nftContract.royaltyInfo(1, ethers.parseEther("1"));
      expect(receiver).to.equal(seller.address);
      expect(royaltyAmount).to.equal(ethers.parseEther("0.05")); // 5% of 1 ETH
    });

    it("Should only allow owner to mint", async function () {
      await expect(
        nftContract.connect(seller).mintAsset(seller.address, "test-uri", seller.address, 500)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Marketplace - Fixed Price Listings", function () {
    beforeEach(async function () {
      // Mint an NFT to seller
      await nftContract.mintAsset(seller.address, "test-uri", seller.address, 500);
      // Approve marketplace to transfer the NFT
      await nftContract.connect(seller).approve(marketplaceAddress, 1);
    });

    it("Should create listing correctly", async function () {
      const price = ethers.parseEther("1");
      
      await expect(
        marketplaceContract.connect(seller).createListing(nftAddress, 1, price)
      ).to.emit(marketplaceContract, "Listed")
        .withArgs(1, seller.address, nftAddress, 1, price);

      const listing = await marketplaceContract.listings(1);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(price);
      expect(listing.active).to.be.true;
    });

    it("Should allow seller to cancel listing", async function () {
      const price = ethers.parseEther("1");
      await marketplaceContract.connect(seller).createListing(nftAddress, 1, price);
      
      await expect(
        marketplaceContract.connect(seller).cancelListing(1)
      ).to.emit(marketplaceContract, "ListingCancelled").withArgs(1);

      const listing = await marketplaceContract.listings(1);
      expect(listing.active).to.be.false;
    });

    it("Should handle purchase correctly", async function () {
      const price = ethers.parseEther("1");
      await marketplaceContract.connect(seller).createListing(nftAddress, 1, price);

      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      const feeRecipientBalanceBefore = await ethers.provider.getBalance(feeRecipient.address);

      await expect(
        marketplaceContract.connect(buyer).buy(1, { value: price })
      ).to.emit(marketplaceContract, "Purchased")
        .withArgs(1, buyer.address, price);

      // Check NFT ownership transfer
      expect(await nftContract.ownerOf(1)).to.equal(buyer.address);

      // Check payment distribution
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      const feeRecipientBalanceAfter = await ethers.provider.getBalance(feeRecipient.address);

      const expectedFee = price * BigInt(250) / BigInt(10000); // 2.5%
      const expectedRoyalty = price * BigInt(500) / BigInt(10000); // 5%
      const expectedSellerAmount = price - expectedFee - expectedRoyalty;

      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(expectedSellerAmount + expectedRoyalty); // seller gets both seller proceeds and royalty
      expect(feeRecipientBalanceAfter - feeRecipientBalanceBefore).to.equal(expectedFee);
    });

    it("Should reject incorrect payment amount", async function () {
      const price = ethers.parseEther("1");
      await marketplaceContract.connect(seller).createListing(nftAddress, 1, price);

      await expect(
        marketplaceContract.connect(buyer).buy(1, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Wrong value");
    });
  });

  describe("Marketplace - Auctions", function () {
    beforeEach(async function () {
      // Mint an NFT to seller
      await nftContract.mintAsset(seller.address, "test-uri", seller.address, 500);
      // Approve marketplace to transfer the NFT
      await nftContract.connect(seller).approve(marketplaceAddress, 1);
    });

    it("Should create auction correctly", async function () {
      const reservePrice = ethers.parseEther("0.5");
      const duration = 3600; // 1 hour

      await expect(
        marketplaceContract.connect(seller).createAuction(nftAddress, 1, reservePrice, duration)
      ).to.emit(marketplaceContract, "AuctionCreated");

      const auction = await marketplaceContract.auctions(1);
      expect(auction.seller).to.equal(seller.address);
      expect(auction.reservePrice).to.equal(reservePrice);
      expect(auction.settled).to.be.false;
    });

    it("Should handle bidding correctly", async function () {
      const reservePrice = ethers.parseEther("0.5");
      const duration = 3600;
      await marketplaceContract.connect(seller).createAuction(nftAddress, 1, reservePrice, duration);

      const bidAmount = ethers.parseEther("1");
      await expect(
        marketplaceContract.connect(buyer).placeBid(1, { value: bidAmount })
      ).to.emit(marketplaceContract, "BidPlaced")
        .withArgs(1, buyer.address, bidAmount);

      const auction = await marketplaceContract.auctions(1);
      expect(auction.highestBidder).to.equal(buyer.address);
      expect(auction.highestBid).to.equal(bidAmount);
    });

    it("Should allow outbid bidders to withdraw", async function () {
      const reservePrice = ethers.parseEther("0.5");
      const duration = 3600;
      await marketplaceContract.connect(seller).createAuction(nftAddress, 1, reservePrice, duration);

      // First bid
      const firstBid = ethers.parseEther("1");
      await marketplaceContract.connect(buyer).placeBid(1, { value: firstBid });

      // Second higher bid from another account
      const [, , , secondBidder] = await ethers.getSigners();
      const secondBid = ethers.parseEther("1.5");
      await marketplaceContract.connect(secondBidder).placeBid(1, { value: secondBid });

      // First bidder should be able to withdraw
      const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
      
      await expect(
        marketplaceContract.connect(buyer).withdraw(1)
      ).to.emit(marketplaceContract, "Withdrawn")
        .withArgs(1, buyer.address, firstBid);

      const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
      expect(buyerBalanceAfter).to.be.gt(buyerBalanceBefore);
    });

    it("Should settle auction correctly", async function () {
      const reservePrice = ethers.parseEther("0.5");
      const duration = 1; // 1 second for quick testing
      await marketplaceContract.connect(seller).createAuction(nftAddress, 1, reservePrice, duration);

      const bidAmount = ethers.parseEther("1");
      await marketplaceContract.connect(buyer).placeBid(1, { value: bidAmount });

      // Wait for auction to end
      await new Promise(resolve => setTimeout(resolve, 2000));

      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      
      await expect(
        marketplaceContract.settleAuction(1)
      ).to.emit(marketplaceContract, "AuctionSettled")
        .withArgs(1, buyer.address, bidAmount);

      // Check NFT ownership transfer
      expect(await nftContract.ownerOf(1)).to.equal(buyer.address);

      // Check seller received payment
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      expect(sellerBalanceAfter).to.be.gt(sellerBalanceBefore);
    });
  });

  describe("Marketplace - Admin Functions", function () {
    it("Should allow owner to set platform fee", async function () {
      await marketplaceContract.setPlatformFeeBps(500); // 5%
      expect(await marketplaceContract.platformFeeBps()).to.equal(500);
    });

    it("Should allow owner to set fee recipient", async function () {
      const [newRecipient] = await ethers.getSigners();
      await marketplaceContract.setFeeRecipient(newRecipient.address);
      expect(await marketplaceContract.feeRecipient()).to.equal(newRecipient.address);
    });

    it("Should reject invalid platform fee", async function () {
      await expect(
        marketplaceContract.setPlatformFeeBps(10001) // > 100%
      ).to.be.revertedWith("Invalid bps");
    });
  });
});