import { Client, networks } from "@/packages/hello_world/src/index";

const client = new Client({
  ...networks.testnet,
  rpcUrl: "https://soroban-testnet.stellar.org:443",
});

export async function getCampaignCount(): Promise<number> {
  const tx = await client.get_campaign_count();
  return Number(tx.result ?? 0);
}
