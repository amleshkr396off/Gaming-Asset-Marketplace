/* eslint-disable no-console */
require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();

  const NAME = process.env.TICKETS_NAME || "Event Tickets";
  const SYMBOL = process.env.TICKETS_SYMBOL || "ETIX";
  const CONFIRMATIONS = Number(process.env.CONFIRMATIONS || (network === "hardhat" ? 1 : 5));

  console.log(`Deploying EventTicketing to ${network} with deployer ${deployer.address} ...`);

  const Factory = await hre.ethers.getContractFactory("EventTicketing");
  const contract = await Factory.deploy(NAME, SYMBOL);
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`EventTicketing deployed at: ${address}`);
  console.log(`Awaiting ${CONFIRMATIONS} block confirmations...`);
  await contract.deploymentTransaction().wait(CONFIRMATIONS);

  // Optional: create an initial event from environment variables
  const CREATE_EVENT = process.env.CREATE_INITIAL_EVENT === "true";
  if (CREATE_EVENT) {
    const EVENT_NAME = process.env.EVENT_NAME || "Sample Event";
    const ORGANIZER = process.env.ORGANIZER || deployer.address;
    const MAX_SUPPLY = BigInt(process.env.MAX_SUPPLY || "0"); // 0 = unlimited
    const BASE_URI = process.env.BASE_URI || ""; // e.g., ipfs://<CID>/

    console.log(`Creating event: ${EVENT_NAME}, organizer=${ORGANIZER}, maxSupply=${MAX_SUPPLY}, baseURI='${BASE_URI}'`);
    const tx = await contract.createEvent(EVENT_NAME, ORGANIZER, MAX_SUPPLY, BASE_URI);
    const rc = await tx.wait();
    const evt = rc.logs.find(l => l.fragment && l.fragment.name === "EventCreated");
    const eventId = evt ? evt.args[0] : undefined;
    console.log(`Asset created with id: ${eventId?.toString?.() ?? "unknown"}`);
  }

  // Optional: Etherscan/Polygonscan verification
  if (process.env.ETHERSCAN_API_KEY || process.env.POLYGONSCAN_API_KEY) {
    try {
      console.log("Verifying contract...");
      await hre.run("verify:verify", {
        address,
        constructorArguments: [NAME, SYMBOL],
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

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
