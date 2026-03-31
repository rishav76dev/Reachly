import { useQuery } from "@tanstack/react-query";
import type { SignTransaction } from "@stellar/stellar-sdk/contract";
import { Client, networks } from "@/packages/hello_world/src/index";
import type { Campaign, CampaignStats, CampaignStatus, Submission } from "@/types";

const CAMPAIGN_NAME_STORAGE_PREFIX = "Reachly:campaign-name";
const READ_BATCH_SIZE = 4;
const RATE_LIMIT_RETRY_DELAYS_MS = [250, 500, 1_000] as const;
const STELLAR_RATE_LIMIT_MESSAGE = "requests limited to 15/sec";
const STROOPS_PER_XLM = 10n ** 7n;

export const rpcUrl =
  import.meta.env.VITE_STELLAR_RPC_URL ??
  import.meta.env.VITE_RPC_URL ??
  "https://soroban-testnet.stellar.org:443";

export const networkPassphrase =
  import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE ?? networks.testnet.networkPassphrase;

function resolveStellarContractId(): string {
  const configured = import.meta.env.VITE_STELLAR_CONTRACT_ID?.trim();

  if (!configured) {
    return networks.testnet.contractId;
  }

  if (configured.startsWith("0x")) {
    throw new Error(
      `Invalid Soroban contract ID: ${configured}. Set VITE_STELLAR_CONTRACT_ID to a Stellar contract address (starts with 'C'), not an EVM 0x address.`,
    );
  }

  return configured;
}

export const contractAddress = resolveStellarContractId();

export const tokenAddress = import.meta.env.VITE_STELLAR_TOKEN_ADDRESS as string | undefined;

export const campaignsQueryKey = ["campaigns", contractAddress, rpcUrl] as const;

export const workerBaseUrl = import.meta.env.VITE_WORKER_URL ?? "http://localhost:3001";

function shouldAllowHttpRpc(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:";
  } catch {
    return url.startsWith("http://");
  }
}

function campaignNameStorageKey(campaignId: number): string {
  return `${CAMPAIGN_NAME_STORAGE_PREFIX}:${contractAddress ?? "unconfigured"}:${campaignId}`;
}

function readCampaignName(campaignId: number): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(campaignNameStorageKey(campaignId));
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveCampaignName(campaignId: number, onChainName: string): string {
  const preferred = readCampaignName(campaignId);

  if (preferred) {
    return preferred;
  }

  const normalized = onChainName.trim();
  return normalized.length > 0 ? normalized : `Campaign #${campaignId}`;
}

export function saveCampaignName(campaignId: number, name: string) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = name.trim();

  if (!normalized) {
    window.localStorage.removeItem(campaignNameStorageKey(campaignId));
    return;
  }

  window.localStorage.setItem(campaignNameStorageKey(campaignId), normalized);
}

function getClient(options?: { publicKey?: string; signTransaction?: SignTransaction }) {
  if (!contractAddress) {
    throw new Error("Contract is not configured. Set VITE_STELLAR_CONTRACT_ID.");
  }

  return new Client({
    contractId: contractAddress,
    networkPassphrase,
    rpcUrl,
    allowHttp: shouldAllowHttpRpc(rpcUrl),
    publicKey: options?.publicKey,
    signTransaction: options?.signTransaction,
  });
}

function isStellarRateLimitError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(STELLAR_RATE_LIMIT_MESSAGE);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, milliseconds);
  });
}

async function withRateLimitRetry<T>(callback: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await callback();
    } catch (error) {
      const retryDelay = RATE_LIMIT_RETRY_DELAYS_MS[attempt];

      if (!retryDelay || !isStellarRateLimitError(error)) {
        throw error;
      }

      await wait(retryDelay);
    }
  }
}

async function mapInBatches<TItem, TResult>(
  items: readonly TItem[],
  mapper: (item: TItem, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = [];

  for (let index = 0; index < items.length; index += READ_BATCH_SIZE) {
    const batch = items.slice(index, index + READ_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => mapper(item, index + batchIndex)),
    );

    results.push(...batchResults);
  }

  return results;
}

function shortenAddress(address: string): string {
  return address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

function gradientForId(id: number): string {
  const gradients = [
    "linear-gradient(135deg, #b8fe66 0%, #4ade80 100%)",
    "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
    "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
    "linear-gradient(135deg, #34d399 0%, #059669 100%)",
    "linear-gradient(135deg, #f472b6 0%, #ec4899 100%)",
  ];

  return gradients[id % gradients.length] ?? gradients[0];
}

function formatStroopsToXlm(stroops: bigint): number {
  return Number(stroops) / Number(STROOPS_PER_XLM);
}

function parseXlmToStroops(value: string): bigint {
  const normalized = value.trim();

  if (!/^\d+(\.\d{1,7})?$/.test(normalized)) {
    throw new Error("Budget must be a valid XLM amount with up to 7 decimals.");
  }

  const [wholePart, decimalPart = ""] = normalized.split(".");
  const paddedDecimals = `${decimalPart}0000000`.slice(0, 7);

  return BigInt(wholePart) * STROOPS_PER_XLM + BigInt(paddedDecimals);
}

export function getCampaignStatus(
  deadlineUnix: number,
  resultsFinalized: boolean,
): CampaignStatus {
  if (resultsFinalized) {
    return "finalized";
  }

  return Date.now() >= deadlineUnix * 1000 ? "closed" : "active";
}

export function daysUntil(deadline: string): number {
  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getTotalViews(campaign: Campaign): number {
  return campaign.submissions.reduce((acc, submission) => acc + submission.views, 0);
}

export function getGlobalStats(campaigns: Campaign[]) {
  const totalBudget = campaigns.reduce((sum, campaign) => sum + campaign.totalBudget, 0);
  const totalSubmissions = campaigns.reduce(
    (sum, campaign) => sum + campaign.submissions.length,
    0,
  );
  const totalViews = campaigns.reduce(
    (sum, campaign) => sum + (campaign.totalViews ?? getTotalViews(campaign)),
    0,
  );
  const active = campaigns.filter((campaign) => campaign.status === "active").length;

  return { totalBudget, totalSubmissions, totalViews, active };
}

function buildCampaignBase(
  id: number,
  onChainCampaign: Awaited<ReturnType<Client["get_campaign"]>>["result"],
): Omit<Campaign, "submissions"> {
  if (!onChainCampaign) {
    throw new Error(`Campaign ${id} not found on-chain.`);
  }

  const deadlineUnix = Number(onChainCampaign.deadline);

  return {
    id: id.toString(),
    name: resolveCampaignName(id, onChainCampaign.name),
    description:
      "This campaign is loaded from Soroban state. Rich metadata is not stored on-chain yet, so the UI shows live budget and timing data.",
    category: "Other",
    totalBudget: formatStroopsToXlm(onChainCampaign.total_budget),
    totalBudgetWei: onChainCampaign.total_budget,
    deadline: new Date(deadlineUnix * 1000).toISOString(),
    deadlineUnix,
    status: getCampaignStatus(deadlineUnix, onChainCampaign.results_finalized),
    creatorAddress: onChainCampaign.brand,
    coverGradient: gradientForId(id),
    totalViews: Number(onChainCampaign.total_views),
    resultsFinalized: onChainCampaign.results_finalized,
  };
}

async function fetchCampaigns(): Promise<Campaign[]> {
  if (!contractAddress) {
    return [];
  }

  const client = getClient();

  const countTx = await withRateLimitRetry(() => client.get_campaign_count());
  const campaignCount = Number(countTx.result ?? 0);

  if (campaignCount === 0) {
    return [];
  }

  return mapInBatches(Array.from({ length: campaignCount }, (_, index) => index), async (index) => {
    const campaignTx = await withRateLimitRetry(() =>
      client.get_campaign({ campaign_id: index }),
    );

    const campaign = campaignTx.result;
    const submissionCount = campaign?.submissions.length ?? 0;

    return {
      ...buildCampaignBase(index, campaign),
      submissions: [],
      submissionCount,
    };
  });
}

async function fetchCampaignDetail(campaignId: number): Promise<Campaign | null> {
  if (!contractAddress) {
    return null;
  }

  const client = getClient();
  const campaignTx = await withRateLimitRetry(() =>
    client.get_campaign({ campaign_id: campaignId }),
  );

  const campaign = campaignTx.result;

  if (!campaign) {
    return null;
  }

  const submissions: Submission[] = campaign.submissions.map((submission, index) => ({
    id: `${campaignId}-${index}`,
    contractIndex: index,
    creator: shortenAddress(submission.creator),
    creatorFull: submission.creator,
    tweetLink: submission.link,
    views: Number(submission.views),
    reward: formatStroopsToXlm(submission.reward),
    rewardWei: submission.reward,
    claimed: submission.paid,
    submittedAt: "",
  }));

  return {
    ...buildCampaignBase(campaignId, campaign),
    submissions,
    submissionCount: submissions.length,
  };
}

export async function createCampaignTx(params: {
  name: string;
  brand: string;
  durationSeconds: number;
  budgetXlm: string;
  signTransaction: SignTransaction;
}): Promise<number> {
  if (!tokenAddress) {
    throw new Error(
      "Token is not configured. Set VITE_STELLAR_TOKEN_ADDRESS in client/.env (or .env.local) to the Soroban token contract used for campaign rewards, then restart Vite.",
    );
  }

  const duration = BigInt(params.durationSeconds);

  if (duration <= 0n) {
    throw new Error("Campaign duration must be greater than zero.");
  }

  const totalBudget = parseXlmToStroops(params.budgetXlm);

  if (totalBudget <= 0n) {
    throw new Error("Campaign budget must be greater than zero.");
  }

  const client = getClient({
    publicKey: params.brand,
    signTransaction: params.signTransaction,
  });

  const tx = await client.create_campaign(
    {
      name: params.name,
      brand: params.brand,
      token_address: tokenAddress,
      duration,
      total_budget: totalBudget,
    },
    {
      publicKey: params.brand,
      signTransaction: params.signTransaction,
      restore: true,
    },
  );

  const sent = await tx.signAndSend();
  const id = sent.result ?? tx.result;

  if (typeof id !== "number") {
    throw new Error("Campaign was submitted, but no campaign ID was returned by the contract.");
  }

  return id;
}

export async function submitCampaignPostTx(params: {
  campaignId: number;
  creator: string;
  tweetLink: string;
  signTransaction: SignTransaction;
}) {
  const client = getClient({
    publicKey: params.creator,
    signTransaction: params.signTransaction,
  });

  const tx = await client.submit(
    {
      campaign_id: params.campaignId,
      creator: params.creator,
      link: params.tweetLink,
    },
    {
      publicKey: params.creator,
      signTransaction: params.signTransaction,
      restore: true,
    },
  );

  await tx.signAndSend();
}

export async function setCampaignViewsTx(params: {
  campaignId: number;
  index: number;
  views: number;
  caller: string;
  signTransaction: SignTransaction;
}) {
  if (!Number.isFinite(params.views) || params.views < 0) {
    throw new Error("Views must be a non-negative number.");
  }

  const client = getClient({
    publicKey: params.caller,
    signTransaction: params.signTransaction,
  });

  const tx = await client.set_views(
    {
      campaign_id: params.campaignId,
      index: params.index,
      views: BigInt(Math.floor(params.views)),
    },
    {
      publicKey: params.caller,
      signTransaction: params.signTransaction,
      restore: true,
    },
  );

  await tx.signAndSend();
}

export async function finalizeCampaignResultsTx(params: {
  campaignId: number;
  caller: string;
  signTransaction: SignTransaction;
}) {
  const client = getClient({
    publicKey: params.caller,
    signTransaction: params.signTransaction,
  });

  const tx = await client.finalize_results(
    { campaign_id: params.campaignId },
    {
      publicKey: params.caller,
      signTransaction: params.signTransaction,
      restore: true,
    },
  );

  await tx.signAndSend();
}

export async function claimCampaignRewardTx(params: {
  campaignId: number;
  index: number;
  creator: string;
  signTransaction: SignTransaction;
}) {
  const client = getClient({
    publicKey: params.creator,
    signTransaction: params.signTransaction,
  });

  const tx = await client.claim_reward(
    {
      campaign_id: params.campaignId,
      index: params.index,
      creator: params.creator,
    },
    {
      publicKey: params.creator,
      signTransaction: params.signTransaction,
      restore: true,
    },
  );

  await tx.signAndSend();
}

export function useCampaigns() {
  return useQuery({
    queryKey: campaignsQueryKey,
    queryFn: fetchCampaigns,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCampaignDetail(campaignId: number | null) {
  return useQuery({
    queryKey: ["campaign", contractAddress, rpcUrl, campaignId],
    queryFn: async () => {
      if (campaignId === null) {
        return null;
      }

      return fetchCampaignDetail(campaignId);
    },
    enabled: campaignId !== null,
  });
}

export function getCampaignStats(campaign: Campaign): CampaignStats {
  const totalDistributed = campaign.submissions.reduce(
    (sum, submission) => sum + submission.reward,
    0,
  );

  return {
    totalViews: campaign.totalViews ?? getTotalViews(campaign),
    totalSubmissions: campaign.submissions.length,
    totalDistributed,
    remainingBudget: Math.max(campaign.totalBudget - totalDistributed, 0),
  };
}
