// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GamingAssetManagement {
    struct Asset {
        uint256 id;
        string name;
        address owner;
    }

    mapping(uint256 => Asset) public assets;
    uint256 public nextId;

    event AssetCreated(uint256 id, string name, address owner);
    event AssetTransferred(uint256 id, address from, address to);

    function createAsset(string memory name) external {
        assets[nextId] = Asset(nextId, name, msg.sender);
        emit AssetCreated(nextId, name, msg.sender);
        nextId++;
    }

    function transferAsset(uint256 id, address to) external {
        require(assets[id].owner == msg.sender, "Not owner");
        address from = msg.sender;
        assets[id].owner = to;
        emit AssetTransferred(id, from, to);
    }

    function getAsset(uint256 id) external view returns (Asset memory) {
        return assets[id];
    }
}
