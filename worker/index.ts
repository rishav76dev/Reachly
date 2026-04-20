
import "dotenv/config";
import { Keypair } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
import { MongoClient, type Collection } from "mongodb";
import {
  Client as CampaignFactoryClient,
  networks as contractNetworks,
} from "../client/src/packages/hello_world/src/index.ts";
import { scrapeTweet, scrapeBatch, extractTweetId } from "./scraper";

const PORT = Number(process.env.PORT ?? 3001);
const API_KEY = process.env.SCRAPING_DOG_API_KEY ?? "";
const SOROBAN_RPC_URL =
  process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org:443";
const STELLAR_SECRET_KEY = process.env.STELLAR_SECRET_KEY ?? "";
const CONTRACT_ID = process.env.CONTRACT_ID ?? "";
const MONGODB_URI = process.env.MONGODB_URI ?? "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME ?? "reachly";
const MONGODB_METADATA_COLLECTION =
  process.env.MONGODB_METADATA_COLLECTION ?? "campaign_metadata";

if (!API_KEY) {
  console.error(
    "[worker] ❌  SCRAPING_DOG_API_KEY is not set.\n" +
      "           Create a .env file from .env.example and add your key.",
  );
  process.exit(1);
}

type CampaignSubmission = {
  creator: string;
  link: string;
  views: bigint | number;
  reward: bigint | number;
  paid: boolean;
};

type SkippedSyncUpdate = {
  index: number;
  link: string;
  reason: string;
};

type CampaignMetadataRecord = {
  campaignId: string;
  imageUrl?: string;
  fullDescription?: string;
  eligibility?: string[];
  submissionRequirements?: string[];
  tags?: string[];
  community?: string;
  socialHandle?: string;
  maxSubmissionsPerUser?: number;
  verificationMethod?: string;
  customMetadata?: Record<string, unknown>;
  updatedAt?: string;
};

// ── Campaign Metadata Storage ─────────────────────────────────
let mongoClient: MongoClient | null = null;
let metadataCollection: Collection<CampaignMetadataRecord> | null = null;

async function initMetadataStore() {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI must be set for campaign metadata storage. Configure MongoDB in worker/.env and restart the worker.",
    );
  }

  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();

  metadataCollection = mongoClient
    .db(MONGODB_DB_NAME)
    .collection<CampaignMetadataRecord>(MONGODB_METADATA_COLLECTION);

  await metadataCollection.createIndex({ campaignId: 1 }, { unique: true });

  console.log(
    `[metadata] Connected to MongoDB database "${MONGODB_DB_NAME}" collection "${MONGODB_METADATA_COLLECTION}"`,
  );
}

function requireMetadataCollection(): Collection<CampaignMetadataRecord> {
  if (!metadataCollection) {
    throw new Error("Metadata store is not initialized.");
  }

  return metadataCollection;
}

function getCampaignFactoryClient(): CampaignFactoryClient {
  if (!CONTRACT_ID) {
    throw new Error(
      "CONTRACT_ID must be set for contract calls.",
    );
  }

  const baseOptions = {
    ...contractNetworks.testnet,
    rpcUrl: SOROBAN_RPC_URL,
    contractId: CONTRACT_ID,
  };

  if (!STELLAR_SECRET_KEY) {
    return new CampaignFactoryClient(baseOptions);
  }

  const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY);
  const signer = basicNodeSigner(
    keypair,
    contractNetworks.testnet.networkPassphrase,
  );

  return new CampaignFactoryClient({
    ...baseOptions,
    publicKey: keypair.publicKey(),
    ...signer,
  });
}

// ── CORS headers (allow all origins for local dev) ────────────

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// ── Response helpers ──────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function ok(data: unknown): Response {
  return json({
    success: true,
    ...(typeof data === "object" && data !== null ? data : { data }),
  });
}

function err(message: string, status = 400): Response {
  return json({ success: false, error: message }, status);
}

function handleHealth(): Response {
  return ok({
    service: "Reachly Worker",
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      port: PORT,
      scrapingDogConfigured: Boolean(API_KEY),
      contractConfigured: Boolean(CONTRACT_ID),
      signerConfigured: Boolean(STELLAR_SECRET_KEY),
      mongodbConfigured: Boolean(MONGODB_URI),
    },
  });
}

async function handleScrape(req: Request): Promise<Response> {
  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err("Request body must be valid JSON.");
  }

  const raw = body["tweetId"];

  if (!raw || typeof raw !== "string" || raw.trim() === "") {
    return err(
      'Missing or invalid field "tweetId". ' +
        'Pass a tweet ID (e.g. "1876543210987654321") or a full X post URL.',
    );
  }

  const tweetId = extractTweetId(raw.trim());

  console.log(`[/scrape] → tweetId: ${tweetId}`);

  try {
    const result = await scrapeTweet(tweetId, API_KEY);

    console.log(`[/scrape] ✓ views: ${result.views.toLocaleString()}`);

    return ok(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[/scrape] ✗ ${message}`);
    return err(`ScrapingDog request failed: ${message}`, 502);
  }
}


async function handleScrapeBatch(req: Request): Promise<Response> {
  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err("Request body must be valid JSON.");
  }

  const rawIds = body["tweetIds"];

  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return err(
      'Missing or invalid field "tweetIds". ' +
        "Pass a non-empty array of tweet IDs or X post URLs.",
    );
  }

  const ids: string[] = [];
  for (const item of rawIds) {
    if (typeof item !== "string" || item.trim() === "") {
      return err(
        `All entries in "tweetIds" must be non-empty strings. Got: ${JSON.stringify(item)}`,
      );
    }
    ids.push(item.trim());
  }

  const rawConcurrency = body["concurrency"];
  const concurrency = Math.min(
    10,
    Math.max(1, typeof rawConcurrency === "number" ? rawConcurrency : 5),
  );

  console.log(
    `[/scrape-batch] → ${ids.length} tweet(s), concurrency: ${concurrency}`,
  );

  const results = await scrapeBatch(ids, API_KEY, concurrency);

  const succeeded = results.filter((r) => !("error" in r)).length;
  const failed = results.length - succeeded;

  console.log(`[/scrape-batch] ✓ done — ${succeeded} ok, ${failed} failed`);

  return ok({
    count: results.length,
    succeeded,
    failed,
    results,
  });
}


async function handleSyncCampaign(req: Request): Promise<Response> {
  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err("Request body must be valid JSON.");
  }

  const rawCampaignId = body["campaignId"];
  if (
    rawCampaignId === undefined ||
    rawCampaignId === null ||
    (typeof rawCampaignId !== "number" &&
      typeof rawCampaignId !== "string" &&
      typeof rawCampaignId !== "bigint")
  ) {
    return err('Missing or invalid field "campaignId".');
  }

  let campaignId: bigint;
  try {
    campaignId = BigInt(rawCampaignId);
  } catch {
    return err('Field "campaignId" must be a valid integer.');
  }

  try {
    if (campaignId < 0n || campaignId > BigInt(0xffff_ffff)) {
      return err('Field "campaignId" must fit in u32.', 400);
    }

    if (!STELLAR_SECRET_KEY) {
      return err(
        "STELLAR_SECRET_KEY is required for /sync-campaign because set_views submits transactions.",
        500,
      );
    }

    const campaignFactory = getCampaignFactoryClient();
    const campaignIdU32 = Number(campaignId);
    const submissionCountTx = await campaignFactory.get_submission_count({
      campaign_id: campaignIdU32,
    });
    const submissionCount = Number(submissionCountTx.result ?? 0);
    const updates: Array<{
      index: number;
      link: string;
      views: number;
      txHash: string;
    }> = [];
    const skipped: SkippedSyncUpdate[] = [];

    console.log(`[/sync-campaign] → campaignId: ${campaignId}`);
    console.log(`[/sync-campaign] → submissions: ${submissionCount}`);

    if (submissionCount === 0) {
      return json(
        {
          success: false,
          error: `Campaign ${campaignId} has no submissions. Sync skipped.`,
          campaignId: campaignId.toString(),
          submissionCount,
          updates,
          skipped,
        },
        409,
      );
    }

    for (let index = 0; index < submissionCount; index++) {
      const submissionTx = await campaignFactory.get_submission({
        campaign_id: campaignIdU32,
        index,
      });
      const submission = submissionTx.result as CampaignSubmission | undefined;

      if (!submission) {
        skipped.push({
          index,
          link: "",
          reason: "submission data unavailable",
        });
        continue;
      }

      let views = 0;
      let scrapeFailed = false;

      try {
        const result = await scrapeTweet(submission.link, API_KEY);
        views = result.views;
        console.log(
          `[/sync-campaign] [${index}] scraped ${views} views for ${submission.link}`,
        );
      } catch (scrapeError) {
        const message =
          scrapeError instanceof Error
            ? scrapeError.message
            : String(scrapeError);
        scrapeFailed = true;
        console.warn(
          `[/sync-campaign] [${index}] scrape failed: ${message}. Skipping on-chain update.`,
        );
        skipped.push({
          index,
          link: submission.link,
          reason: `scrape failed: ${message}`,
        });
      }

      if (scrapeFailed) {
        continue;
      }

      if (views <= 0) {
        console.log(
          `[/sync-campaign] [${index}] skipping ${submission.link} because scraped views were 0.`,
        );
        skipped.push({
          index,
          link: submission.link,
          reason: "scraped views were 0",
        });
        continue;
      }

      const tx = await campaignFactory.set_views({
        campaign_id: campaignIdU32,
        index,
        views: BigInt(views),
      });
      const sent = await tx.signAndSend();
      const txHash = sent.sendTransactionResponse?.hash ?? "";

      updates.push({
        index,
        link: submission.link,
        views,
        txHash,
      });
    }

    if (updates.length === 0) {
      return json(
        {
          success: false,
          error: `Campaign ${campaignId} has no non-zero scraped views. Sync skipped.`,
          campaignId: campaignId.toString(),
          submissionCount,
          updates,
          skipped,
        },
        409,
      );
    }

    return ok({
      campaignId: campaignId.toString(),
      submissionCount,
      updates,
      skipped,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[/sync-campaign] ✗ ${message}`);
    return err(`Campaign sync failed: ${message}`, 502);
  }
}

async function handleGetCampaignMetadata(campaignId: string): Promise<Response> {
  let collection: Collection<CampaignMetadataRecord>;

  try {
    collection = requireMetadataCollection();
  } catch (error) {
    return err(
      error instanceof Error ? error.message : "Metadata store is unavailable.",
      503,
    );
  }

  const metadata = await collection.findOne({ campaignId });

  if (!metadata) {
    return err(`Campaign metadata not found for ${campaignId}`, 404);
  }

  return ok({
    ...metadata,
    campaignId: metadata.campaignId,
  });
}

async function handleSaveCampaignMetadata(
  campaignId: string,
  req: Request,
): Promise<Response> {
  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err("Request body must be valid JSON.");
  }

  const metadata = {
    campaignId,
    imageUrl: body.imageUrl as string | undefined,
    fullDescription: body.fullDescription as string | undefined,
    eligibility: Array.isArray(body.eligibility) ? (body.eligibility as string[]) : undefined,
    submissionRequirements: Array.isArray(body.submissionRequirements)
      ? (body.submissionRequirements as string[])
      : undefined,
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
    community: body.community as string | undefined,
    socialHandle: body.socialHandle as string | undefined,
    maxSubmissionsPerUser:
      typeof body.maxSubmissionsPerUser === "number" ? body.maxSubmissionsPerUser : undefined,
    verificationMethod: body.verificationMethod as string | undefined,
    customMetadata: (typeof body.customMetadata === "object" && body.customMetadata !== null)
      ? (body.customMetadata as Record<string, unknown>)
      : undefined,
    updatedAt: new Date().toISOString(),
  };

  let collection: Collection<CampaignMetadataRecord>;

  try {
    collection = requireMetadataCollection();
  } catch (error) {
    return err(
      error instanceof Error ? error.message : "Metadata store is unavailable.",
      503,
    );
  }

  await collection.replaceOne({ campaignId }, metadata, { upsert: true });

  console.log(`[metadata] Saved metadata for campaign ${campaignId}`);

  return ok({
    campaignId,
    metadata,
    message: "Campaign metadata saved successfully",
  });
}

async function handleListCampaigns(): Promise<Response> {
  let collection: Collection<CampaignMetadataRecord>;

  try {
    collection = requireMetadataCollection();
  } catch (error) {
    return err(
      error instanceof Error ? error.message : "Metadata store is unavailable.",
      503,
    );
  }

  const campaigns = await collection.find({}).toArray();

  return ok({
    count: campaigns.length,
    campaigns: campaigns.map((campaign) => ({
      ...campaign,
      id: campaign.campaignId,
    })),
  });
}

async function router(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);
  const method = req.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // ── Routes ────────────────────────────────────────────────
  if (method === "GET" && pathname === "/health") {
    return handleHealth();
  }

  if (method === "POST" && pathname === "/scrape") {
    return handleScrape(req);
  }

  if (method === "POST" && pathname === "/scrape-batch") {
    return handleScrapeBatch(req);
  }

  if (method === "POST" && pathname === "/sync-campaign") {
    return handleSyncCampaign(req);
  }

  // ── Metadata API Routes ────────────────────────────────────
  if (method === "GET" && pathname === "/api/campaigns") {
    return handleListCampaigns();
  }

  const metadataMatch = pathname.match(/^\/api\/campaigns\/([^/]+)\/metadata$/);
  if (metadataMatch) {
    const campaignId = metadataMatch[1];

    if (!campaignId) {
      return err("Campaign id is required.");
    }

    if (method === "GET") {
      return handleGetCampaignMetadata(campaignId);
    }

    if (method === "POST" || method === "PUT") {
      return handleSaveCampaignMetadata(campaignId, req);
    }
  }

  // ── 404 ───────────────────────────────────────────────────
  return err(
    `Route not found: ${method} ${pathname}. ` +
      "Available: GET /health · POST /scrape · POST /scrape-batch · POST /sync-campaign · GET/POST /api/campaigns/:id/metadata",
    404,
  );
}

// ── Initialize metadata store ─────────────────────────────────
void initMetadataStore().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[metadata] continuing without MongoDB: ${message}`);
});

// ── Start server ──────────────────────────────────────────────

const server = Bun.serve({
  port: PORT,
  fetch: router,
});

const listenHost = server.hostname || "0.0.0.0";
const publicRenderUrl = process.env.RENDER_EXTERNAL_URL;

console.log(`
╭─────────────────────────────────────────────────────────────╮
│   Reachly Worker                                             │
│   Listening on http://${listenHost}:${PORT}                         │
│                                                             │
│   Core APIs:                                                │
│   GET  /health                            (health check)   │
│   POST /scrape                            (single tweet)   │
│   POST /scrape-batch                      (bulk tweets)    │
│   POST /sync-campaign                     (on-chain sync)  │
│                                                             │
│   Metadata APIs:                                            │
│   GET  /api/campaigns/:id/metadata        (fetch)          │
│   POST /api/campaigns/:id/metadata        (update)         │
│   GET  /api/campaigns                     (list all)       │
╰─────────────────────────────────────────────────────────────╯
`);

if (publicRenderUrl) {
  console.log(`[worker] Public URL: ${publicRenderUrl}`);
}


