# Gaming Asset Marketplace

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Solidity](https://img.shields.io/badge/solidity-^0.8.13-green.svg)

A decentralized marketplace for trading gaming assets as NFTs with fixed-price listings and auction functionality. Built with Solidity smart contracts and Hardhat for development and testing.

> **Note**: This marketplace enables secure trading of gaming assets with built-in royalty support and platform fees.

---

## Key Features
- **ERC-721 Gaming Asset NFTs**: Mint unique gaming items with metadata and royalties
- **Fixed-Price Marketplace**: List and buy gaming assets at set prices
- **Auction System**: Create time-based auctions with bidding functionality
- **Royalty Support**: ERC-2981 compliant royalties for creators
- **Platform Fees**: Configurable marketplace fees
- **Secure Transfers**: ReentrancyGuard and safe ETH transfers
- **Multi-Network Support**: Deploy on Core testnet or any EVM-compatible network

---

## Tech Stack
- **Solidity ^0.8.13**: Smart contract development
- **Hardhat**: Development framework and testing
- **OpenZeppelin**: Security-audited contract libraries
- **Ethers.js**: Blockchain interaction
- **Chai**: Testing framework
- **Core Network**: Default deployment target

---

## Project Structure
```
gaming-asset-marketplace/
├── contracts/
│   └── Project.sol           # Main contracts (GamingAssetNFT + Marketplace)
├── scripts/
│   └── deploy.js            # Deployment script
├── tests/
│   └── lock.js              # Comprehensive test suite
├── hardhat.config.js        # Hardhat configuration
├── package.json             # Dependencies and scripts
├── .env.example             # Environment variables template
└── README.md               # This file
```

---

## Quick Start

### 1. Installation
```bash
npm install
```

### 2. Environment Setup
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your private key and configuration
# PRIVATE_KEY=your_private_key_here
```

### 3. Compile Contracts
```bash
npm run compile
```

### 4. Run Tests
```bash
npm test
```

### 5. Deploy to Core Testnet
```bash
npm run deploy
```

---

## Smart Contracts

### GamingAssetNFT
- **ERC-721 NFT contract** for gaming assets
- **Royalty support** (ERC-2981) for creators
- **Owner-only minting** with metadata URIs
- **Royalty configuration** per token or default

### Marketplace
- **Fixed-price listings** with instant buy functionality
- **Auction system** with bidding and settlement
- **Platform fee collection** (configurable basis points)
- **Royalty distribution** on secondary sales
- **Secure fund handling** with reentrancy protection

---

## Usage Examples

### Deploying Contracts
```javascript
// The deploy script will:
// 1. Deploy GamingAssetNFT contract
// 2. Deploy Marketplace contract
// 3. Optionally mint initial gaming assets
// 4. Verify contracts on block explorer
```

### Minting Gaming Assets
```javascript
// Only contract owner can mint
await nftContract.mintAsset(
  recipientAddress,
  "https://metadata-uri.com/sword.json",
  royaltyRecipient,
  500 // 5% royalty in basis points
);
```

### Creating Marketplace Listings
```javascript
// Seller must approve marketplace first
await nftContract.approve(marketplaceAddress, tokenId);

// Create fixed-price listing
await marketplace.createListing(
  nftContractAddress,
  tokenId,
  ethers.parseEther("1.0") // Price in ETH
);
```

### Creating Auctions
```javascript
// Create auction with reserve price and duration
await marketplace.createAuction(
  nftContractAddress,
  tokenId,
  ethers.parseEther("0.5"), // Reserve price
  3600 // Duration in seconds (1 hour)
);
```

---

## Configuration

### Environment Variables
```bash
# Required
PRIVATE_KEY=your_private_key_without_0x_prefix

# NFT Contract Settings
NFT_NAME=Gaming Asset NFT
NFT_SYMBOL=GANFT

# Marketplace Settings
PLATFORM_FEE_BPS=250  # 2.5% platform fee

# Deployment Settings
CONFIRMATIONS=5
MINT_INITIAL_ASSETS=false

# Optional: Contract Verification
ETHERSCAN_API_KEY=your_api_key
```

### Network Configuration
The project is configured for Core testnet by default. To use other networks:

1. Update `hardhat.config.js` with your desired network
2. Update the deploy script command in `package.json`
3. Ensure you have the native token for gas fees

---

## Testing

The test suite covers:
- ✅ NFT minting and metadata
- ✅ Royalty functionality
- ✅ Fixed-price listings and purchases
- ✅ Auction creation and bidding
- ✅ Fund distribution (fees, royalties, seller proceeds)
- ✅ Access control and edge cases

Run tests:
```bash
npm test
```

---

## Security Features

- **ReentrancyGuard**: Prevents reentrancy attacks
- **Ownable**: Access control for admin functions
- **Safe transfers**: Proper ETH transfer handling
- **Input validation**: Comprehensive parameter checking
- **OpenZeppelin libraries**: Battle-tested contract components

---

## License
MIT License - see LICENSE file for details

---

## Support

For issues or questions:
1. Check the test files for usage examples
2. Review the smart contract documentation
3. Create an issue in the repository


