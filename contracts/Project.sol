// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/// @title Gaming Asset Marketplace - ERC721 asset + marketplace (fixed-price + simple auctions + ERC2981 royalties)
/// @notice Minimal, practical implementation for development and testing (Hardhat). Uses OpenZeppelin contracts.
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract GamingAssetNFT is ERC721Royalty, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    mapping(uint256 => string) private _tokenURIs;

    event AssetMinted(address indexed to, uint256 indexed tokenId, string tokenURI, address royaltyReceiver, uint96 royaltyBps);

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {}

    /// @notice Mint an ERC721 game asset. Owner only.
    function mintAsset(
        address to,
        string calldata tokenURI_,
        address royaltyReceiver,
        uint96 royaltyBps // basis points (10000 = 100%)
    ) external onlyOwner returns (uint256) {
        require(to != address(0), "Invalid recipient");
        _tokenIds.increment();
        uint256 id = _tokenIds.current();
        _safeMint(to, id);
        _tokenURIs[id] = tokenURI_;
        if (royaltyReceiver != address(0) && royaltyBps > 0) {
            _setTokenRoyalty(id, royaltyReceiver, royaltyBps);
        }
        emit AssetMinted(to, id, tokenURI_, royaltyReceiver, royaltyBps);
        return id;
    }

    function setTokenURI(uint256 tokenId, string calldata uri) external onlyOwner {
        require(_exists(tokenId), "Nonexistent");
        _tokenURIs[tokenId] = uri;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Nonexistent");
        string memory t = _tokenURIs[tokenId];
        return bytes(t).length > 0 ? t : "";
    }

    /// allow owner to set default royalty for all tokens (ERC2981)
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function deleteDefaultRoyalty() external onlyOwner {
        _deleteDefaultRoyalty();
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC721Royalty) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

contract Marketplace is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _listingIds;
    Counters.Counter private _auctionIds;

    uint256 public platformFeeBps; // e.g., 250 = 2.5%
    address public feeRecipient;

    struct Listing {
        address assetContract;
        uint256 tokenId;
        address seller;
        uint256 price;
        bool active;
    }

    struct Auction {
        address assetContract;
        uint256 tokenId;
        address seller;
        uint256 reservePrice;
        uint256 endTime;
        address highestBidder;
        uint256 highestBid;
        bool settled;
    }

    // listingId => Listing
    mapping(uint256 => Listing) public listings;
    // auctionId => Auction
    mapping(uint256 => Auction) public auctions;
    // auctionId => bidder => refundable amount
    mapping(uint256 => mapping(address => uint256)) public pendingReturns;

    event Listed(uint256 indexed listingId, address indexed seller, address assetContract, uint256 tokenId, uint256 price);
    event ListingCancelled(uint256 indexed listingId);
    event Purchased(uint256 indexed listingId, address indexed buyer, uint256 price);
    event AuctionCreated(uint256 indexed auctionId, address indexed seller, address assetContract, uint256 tokenId, uint256 reservePrice, uint256 endTime);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event Withdrawn(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionSettled(uint256 indexed auctionId, address indexed winner, uint256 amount);

    constructor(address _feeRecipient, uint256 _platformFeeBps) {
        require(_platformFeeBps <= 10000, "Invalid fee bps");
        feeRecipient = _feeRecipient;
        platformFeeBps = _platformFeeBps;
    }

    // --------------------
    // Listings (fixed-price)
    // --------------------

    /// @notice Create a fixed-price listing. Seller must be owner and approve marketplace.
    function createListing(address assetContract, uint256 tokenId, uint256 price) external nonReentrant returns (uint256) {
        require(price > 0, "Price zero");
        IERC721 token = IERC721(assetContract);
        require(token.ownerOf(tokenId) == msg.sender, "Not owner");
        _listingIds.increment();
        uint256 lid = _listingIds.current();
        listings[lid] = Listing({ assetContract: assetContract, tokenId: tokenId, seller: msg.sender, price: price, active: true });
        emit Listed(lid, msg.sender, assetContract, tokenId, price);
        return lid;
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active, "Not active");
        require(l.seller == msg.sender || owner() == msg.sender, "Not seller/owner");
        l.active = false;
        emit ListingCancelled(listingId);
    }

    /// @notice Buy listed token by sending exact price.
    function buy(uint256 listingId) external payable nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active, "Not active");
        require(msg.value == l.price, "Wrong value");

        l.active = false;

        uint256 salePrice = msg.value;
        uint256 platformFee = (salePrice * platformFeeBps) / 10000;
        uint256 remaining = salePrice - platformFee;

        // Handle ERC2981 royalties if supported
        if (supportsRoyalty(l.assetContract)) {
            (address receiver, uint256 royaltyAmount) = IERC2981(l.assetContract).royaltyInfo(l.tokenId, salePrice);
            if (receiver != address(0) && royaltyAmount > 0 && royaltyAmount <= remaining) {
                remaining -= royaltyAmount;
                _safeSendETH(receiver, royaltyAmount);
            }
        }

        // pay seller
        _safeSendETH(l.seller, remaining);

        // pay platform fee
        if (platformFee > 0 && feeRecipient != address(0)) {
            _safeSendETH(feeRecipient, platformFee);
        }

        // transfer token (seller must approve)
        IERC721(l.assetContract).safeTransferFrom(l.seller, msg.sender, l.tokenId);

        emit Purchased(listingId, msg.sender, salePrice);
    }

    // --------------------
    // Auctions (simple)
    // --------------------

    /// @notice Create auction. Seller must be owner and approve marketplace.
    function createAuction(address assetContract, uint256 tokenId, uint256 reservePrice, uint256 durationSeconds) external nonReentrant returns (uint256) {
        require(durationSeconds >= 60, "Duration too short");
        IERC721 token = IERC721(assetContract);
        require(token.ownerOf(tokenId) == msg.sender, "Not owner");
        _auctionIds.increment();
        uint256 aid = _auctionIds.current();
        auctions[aid] = Auction({
            assetContract: assetContract,
            tokenId: tokenId,
            seller: msg.sender,
            reservePrice: reservePrice,
            endTime: block.timestamp + durationSeconds,
            highestBidder: address(0),
            highestBid: 0,
            settled: false
        });
        emit AuctionCreated(aid, msg.sender, assetContract, tokenId, reservePrice, block.timestamp + durationSeconds);
        return aid;
    }

    /// @notice Place bid. Must exceed current highest and meet reserve.
    function placeBid(uint256 auctionId) external payable nonReentrant {
        Auction storage a = auctions[auctionId];
        require(block.timestamp < a.endTime, "Ended");
        require(msg.value > a.highestBid && msg.value >= a.reservePrice, "Bid too low");

        if (a.highestBidder != address(0)) {
            // store refundable amount for previous highest bidder
            pendingReturns[auctionId][a.highestBidder] += a.highestBid;
        }

        a.highestBid = msg.value;
        a.highestBidder = msg.sender;

        emit BidPlaced(auctionId, msg.sender, msg.value);
    }

    /// @notice Withdraw refunds for outbid bidders
    function withdraw(uint256 auctionId) external nonReentrant {
        uint256 amount = pendingReturns[auctionId][msg.sender];
        require(amount > 0, "Nothing to withdraw");
        pendingReturns[auctionId][msg.sender] = 0;
        _safeSendETH(msg.sender, amount);
        emit Withdrawn(auctionId, msg.sender, amount);
    }

    /// @notice Settle auction after endTime. Transfers token to winner and distributes funds.
    function settleAuction(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(block.timestamp >= a.endTime, "Not ended");
        require(!a.settled, "Already settled");
        a.settled = true;

        if (a.highestBidder == address(0)) {
            // no bids: nothing to do
            return;
        }

        uint256 salePrice = a.highestBid;
        uint256 platformFee = (salePrice * platformFeeBps) / 10000;
        uint256 remaining = salePrice - platformFee;

        if (supportsRoyalty(a.assetContract)) {
            (address receiver, uint256 royaltyAmount) = IERC2981(a.assetContract).royaltyInfo(a.tokenId, salePrice);
            if (receiver != address(0) && royaltyAmount > 0 && royaltyAmount <= remaining) {
                remaining -= royaltyAmount;
                _safeSendETH(receiver, royaltyAmount);
            }
        }

        // send seller proceeds
        _safeSendETH(a.seller, remaining);

        // platform fee
        if (platformFee > 0 && feeRecipient != address(0)) {
            _safeSendETH(feeRecipient, platformFee);
        }

        // transfer token to winner (seller must have approved)
        IERC721(a.assetContract).safeTransferFrom(a.seller, a.highestBidder, a.tokenId);

        emit AuctionSettled(auctionId, a.highestBidder, salePrice);
    }

    // --------------------
    // Admin / helpers
    // --------------------

    function setPlatformFeeBps(uint256 bps) external onlyOwner {
        require(bps <= 10000, "Invalid bps");
        platformFeeBps = bps;
    }

    function setFeeRecipient(address recipient) external onlyOwner {
        feeRecipient = recipient;
    }

    function supportsRoyalty(address assetContract) internal view returns (bool) {
        try IERC2981(assetContract).royaltyInfo(0, 0) returns (address, uint256) {
            return true;
        } catch {
            return false;
        }
    }

    /// @dev Safe ETH send (reverts on failure)
    function _safeSendETH(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool sent, ) = payable(to).call{value: amount}("");
        require(sent, "ETH send failed");
    }

    // allow contract to receive ETH
    receive() external payable {}
    fallback() external payable {}
}
