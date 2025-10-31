import hre from "hardhat";

async function main() {
  const GamingAssetManagement = await hre.ethers.getContractFactory("GamingAssetManagement");
  const contract = await GamingAssetManagement.deploy();

  await contract.waitForDeployment();
  console.log("GamingAssetManagement deployed to:", await contract.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error during deployment:", error);
    process.exit(1);
  });
