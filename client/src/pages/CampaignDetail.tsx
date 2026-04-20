import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { signTransaction as freighterSignTransaction } from "@stellar/freighter-api";
import { Navbar } from "@/components/Navbar";
import { CampaignOverview } from "@/components/campaign/CampaignOverview";
import { MetadataSection } from "@/components/campaign/MetadataSection";
import { ActionBar } from "@/components/campaign/ActionBar";
import { SubmissionList } from "@/components/campaign/SubmissionList";
import { AddSubmissionForm } from "@/components/campaign/AddSubmissionForm";
import {
  claimCampaignRewardTx,
  contractAddress,
  finalizeCampaignResultsTx,
  setCampaignViewsTx,
  submitCampaignPostTx,
  useCampaignDetail,
  workerBaseUrl,
} from "@/lib/campaigns";
import type { Submission } from "@/types";
import { useStellarWallet } from "@/web3/stellarWallet";

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "status-active"
      : status === "finalized"
        ? "status-finalized"
        : "status-closed";
  const label =
    status === "active" ? "Active" : status === "finalized" ? "Finalized" : "Closed";
  return (
    <span
      className={cls}
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: 9999,
        letterSpacing: "0.03em",
        textTransform: "uppercase" as const,
      }}
    >
      {label}
    </span>
  );
}

export function CampaignDetail() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const parsedCampaignId =
    campaignId && /^\d+$/.test(campaignId) ? Number(campaignId) : null;
  const { address, isConnected, isSupportedNetwork, expectedNetwork, networkIssueMessage } = useStellarWallet();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [claimPendingId, setClaimPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);
  const [previewViewsByIndex, setPreviewViewsByIndex] = useState<Record<number, number>>({});
  const [workerReachable, setWorkerReachable] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const hasAutoSyncedRef = useRef(false);
  const {
    data: campaign,
    isLoading,
    isError,
    error,
    refetch,
  } = useCampaignDetail(parsedCampaignId);

  const refreshCampaign = useCallback(async () => {
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
  }, [queryClient, refetch]);

  const handleSyncViews = useCallback(async () => {
    if (!campaign) {
      return;
    }

    if (!workerReachable) {
      setActionError(
        `Worker is offline at ${workerBaseUrl}. Start the worker and try syncing again.`,
      );
      setActionInfo(null);
      return;
    }

    setActionError(null);
    setActionInfo(null);
    setIsSyncing(true);

    try {
      if (campaign.submissions.length === 0) {
        setActionInfo("No submissions yet to sync.");
        return;
      }

      const scrapeRes = await fetch(`${workerBaseUrl}/scrape-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tweetIds: campaign.submissions.map((submission) => submission.tweetLink),
        }),
      });

      const scrapeData = (await scrapeRes.json().catch(() => null)) as
        | {
            error?: string;
            results?: Array<
              | { views?: number; error?: string }
              | null
              | undefined
            >;
          }
        | null;

      if (!scrapeRes.ok || !scrapeData?.results) {
        throw new Error(
          scrapeData?.error ??
            `Worker preview sync failed with status ${scrapeRes.status}`,
        );
      }

      const nextPreviewViews: Record<number, number> = {};

      scrapeData.results.forEach((result, index) => {
        const contractIndex = campaign.submissions[index]?.contractIndex;

        if (
          typeof contractIndex === "number" &&
          result &&
          typeof result.views === "number" &&
          result.views >= 0
        ) {
          nextPreviewViews[contractIndex] = result.views;
        }
      });

      setPreviewViewsByIndex(nextPreviewViews);
      setActionInfo(
        "Preview sync completed. Values shown are worker estimates only and stay off-chain until Finalize Distribution runs.",
      );
    } catch (syncError) {
      setActionError(
        syncError instanceof Error ? syncError.message : String(syncError),
      );
      setActionInfo(null);
    } finally {
      setIsSyncing(false);
    }
  }, [campaign, workerReachable]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkWorkerHealth() {
      try {
        const res = await fetch(`${workerBaseUrl}/health`, { method: "GET" });
        if (!cancelled) {
          setWorkerReachable(res.ok);
        }
      } catch {
        if (!cancelled) {
          setWorkerReachable(false);
        }
      }
    }

    void checkWorkerHealth();
    const healthTimer = window.setInterval(() => {
      void checkWorkerHealth();
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(healthTimer);
    };
  }, []);

  useEffect(() => {
    if (!campaign || isSyncing) {
      return;
    }

    const finalized = campaign.resultsFinalized ?? campaign.status === "finalized";
    const deadlineMs = campaign.deadlineUnix
      ? campaign.deadlineUnix * 1000
      : new Date(campaign.deadline).getTime();
    const isPastDeadline = Number.isFinite(deadlineMs) ? nowMs >= deadlineMs : true;
    const shouldAutoSync = !finalized && isPastDeadline;

    if (!shouldAutoSync || hasAutoSyncedRef.current) {
      return;
    }

    hasAutoSyncedRef.current = true;
    void handleSyncViews();
  }, [campaign, handleSyncViews, isSyncing, nowMs]);

  async function handleFinalize() {
    if (parsedCampaignId === null || !campaign) {
      return;
    }

    if (!isConnected || !address || !contractAddress) {
      setActionError("Connect a wallet before finalizing distribution.");
      setActionInfo(null);
      return;
    }

    if (!isSupportedNetwork) {
      setActionError(networkIssueMessage ?? `Switch your wallet to Stellar ${expectedNetwork} before finalizing distribution.`);
      setActionInfo(null);
      return;
    }

    if (!workerReachable) {
      setActionError(
        `Worker is offline at ${workerBaseUrl}. Start the worker and try finalizing again.`,
      );
      setActionInfo(null);
      return;
    }

    setActionError(null);
    setActionInfo(null);
    setIsSyncing(true);

    try {
      if (campaign.submissions.length === 0) {
        setActionInfo("No submissions yet to finalize.");
        return;
      }

      const scrapeRes = await fetch(`${workerBaseUrl}/scrape-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tweetIds: campaign.submissions.map((submission) => submission.tweetLink),
        }),
      });

      const scrapeData = (await scrapeRes.json().catch(() => null)) as
        | {
            error?: string;
            results?: Array<
              | { views?: number; error?: string }
              | null
              | undefined
            >;
          }
        | null;

      if (!scrapeRes.ok || !scrapeData?.results) {
        throw new Error(
          scrapeData?.error ??
            `Worker preview sync failed with status ${scrapeRes.status}`,
        );
      }

      const viewUpdates: Array<{ index: number; views: number }> = [];

      scrapeData.results.forEach((result, index) => {
        const contractIndex = campaign.submissions[index]?.contractIndex;

        if (
          typeof contractIndex === "number" &&
          result &&
          typeof result.views === "number" &&
          result.views > 0
        ) {
          viewUpdates.push({ index: contractIndex, views: result.views });
        }
      });

      if (viewUpdates.length === 0) {
        setActionError("No views recorded yet. Run Sync Views before finalizing distribution.");
        setActionInfo(null);
        return;
      }

      for (const update of viewUpdates) {
        await setCampaignViewsTx({
          campaignId: parsedCampaignId,
          index: update.index,
          views: update.views,
          caller: address,
          signTransaction: freighterSignTransaction,
        });
      }

      await finalizeCampaignResultsTx({
        campaignId: parsedCampaignId,
        caller: address,
        signTransaction: freighterSignTransaction,
      });

      setPreviewViewsByIndex({});
      setActionInfo("Distribution finalized on-chain.");
      await refreshCampaign();
    } catch (finalizeError) {
      let message =
        finalizeError instanceof Error ? finalizeError.message : String(finalizeError);
      if (message.includes("Error(Contract, #5)") || message.includes("CampaignStillActive")) {
        message = "Wait for the submission deadline to be over before finalizing.";
      }
      if (message.includes("Error(Contract, #8)") || message.includes("NoViewsRecorded")) {
        message = "No views recorded yet. Run Sync Views before finalizing distribution.";
      }
      setActionError(message);
      setActionInfo(null);
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleClaim(id: string) {
    if (!isConnected || !address || !contractAddress || parsedCampaignId === null || !campaign) {
      setActionError("Connect a wallet before claiming rewards.");
      return;
    }

    if (!isSupportedNetwork) {
      setActionError(networkIssueMessage ?? `Switch your wallet to Stellar ${expectedNetwork} before claiming rewards.`);
      return;
    }

    const submission = campaign.submissions.find((item) => item.id === id);

    if (!submission) {
      return;
    }

    setActionError(null);
    setClaimPendingId(id);

    try {
      await claimCampaignRewardTx({
        campaignId: parsedCampaignId,
        index: submission.contractIndex ?? 0,
        creator: address,
        signTransaction: freighterSignTransaction,
      });

      await refreshCampaign();
      setActionInfo("Reward claimed successfully.");
    } catch (claimError) {
      setActionError(
        claimError instanceof Error ? claimError.message : String(claimError),
      );
    } finally {
      setClaimPendingId(null);
    }
  }

  async function handleAddSubmission(tweetLink: string) {
    if (!isConnected || !address || !contractAddress || parsedCampaignId === null) {
      setActionError("Connect a wallet before submitting a post.");
      return;
    }

    if (!isSupportedNetwork) {
      setActionError(networkIssueMessage ?? `Switch your wallet to Stellar ${expectedNetwork} before submitting.`);
      return;
    }

    setActionError(null);
    setIsSubmitting(true);

    try {
      await submitCampaignPostTx({
        campaignId: parsedCampaignId,
        creator: address,
        tweetLink,
        signTransaction: freighterSignTransaction,
      });

      await refreshCampaign();
      setActionInfo("Submission sent on-chain.");
    } catch (submitError) {
      setActionError(
        submitError instanceof Error ? submitError.message : String(submitError),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Not found ─────────────────────────────────────────────────
  if (parsedCampaignId === null) {
    return (
      <div className="detail-page">
        <Navbar />
        <div
          style={{
            textAlign: "center",
            padding: "120px 24px",
            color: "var(--gray-500)",
          }}
        >
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--black)", marginBottom: 8 }}>
            Campaign not found
          </h2>
          <p style={{ marginBottom: 24 }}>
            The campaign ID "{campaignId}" does not exist.
          </p>
          <Link to="/dashboard" className="btn-pill-black" style={{ display: "inline-flex" }}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!contractAddress) {
    return (
      <div className="detail-page">
        <Navbar />
        <div
          style={{
            textAlign: "center",
            padding: "120px 24px",
            color: "var(--gray-500)",
          }}
        >
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--black)", marginBottom: 8 }}>
            Contract not configured
          </h2>
          <p style={{ marginBottom: 24 }}>
            Set <code>VITE_CONTRACT_ADDRESS</code> and <code>VITE_RPC_URL</code> to load campaign details.
          </p>
          <Link to="/dashboard" className="btn-pill-black" style={{ display: "inline-flex" }}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="detail-page">
        <Navbar />
        <div style={{ textAlign: "center", padding: "120px 24px", color: "var(--gray-500)" }}>
          Loading campaign from chain...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="detail-page">
        <Navbar />
        <div style={{ textAlign: "center", padding: "120px 24px", color: "#ef4444" }}>
          Failed to load campaign: {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  }

  if (!campaign) {
    return null;
  }

  const isLocalWorkerUrl =
    workerBaseUrl.includes("localhost") || workerBaseUrl.includes("127.0.0.1");
  const offlineWorkerMessage = isLocalWorkerUrl
    ? `Worker is offline at ${workerBaseUrl}. Start worker/bun dev in the worker folder.`
    : `Worker is offline at ${workerBaseUrl}. Check the deployed worker service and VITE_WORKER_URL.`;

  const finalized = campaign.resultsFinalized ?? campaign.status === "finalized";
  const deadlineMs = campaign.deadlineUnix
    ? campaign.deadlineUnix * 1000
    : new Date(campaign.deadline).getTime();
  const isPastDeadline = Number.isFinite(deadlineMs) ? nowMs >= deadlineMs : true;
  const isActiveNow = !finalized && !isPastDeadline;
  const syncBlocked = !workerReachable;
  const finalizeBlocked =
    !isConnected || !address || !contractAddress || !isSupportedNetwork;
  const syncDisabledReason = finalized
    ? undefined
    : !workerReachable
      ? offlineWorkerMessage
      : actionError ?? undefined;
  const finalizeDisabledReason = finalized
    ? undefined
    : !isConnected || !address
      ? "Connect a wallet to finalize distribution."
      : !contractAddress
        ? "Contract is not configured. Set VITE_STELLAR_CONTRACT_ID."
        : !isSupportedNetwork
          ? `Switch your wallet to Stellar ${expectedNetwork} to finalize distribution.`
          : actionError ?? undefined;
  const addSubmissionDisabled = finalized || campaign.status === "closed";
  const displayedSubmissions: Submission[] = campaign.submissions.map((submission) => {
    const index = submission.contractIndex;
    const previewViews =
      typeof index === "number" ? previewViewsByIndex[index] : undefined;

    if (typeof previewViews !== "number") {
      return submission;
    }

    return {
      ...submission,
      views: previewViews,
    };
  });
  const displayTotalViews = displayedSubmissions.reduce(
    (sum, submission) => sum + submission.views,
    0,
  );
  const displayCampaign = {
    ...campaign,
    submissions: displayedSubmissions,
    totalViews:
      Object.keys(previewViewsByIndex).length > 0 ? displayTotalViews : campaign.totalViews,
  };
  const submitHint = !isConnected
    ? "Connect a wallet to submit your post on-chain."
    : !isSupportedNetwork
      ? `Switch your wallet to Stellar ${expectedNetwork} before submitting.`
      : "Submitting writes directly to the Soroban contract using Freighter.";

  return (
    <div className="detail-page">
      <Navbar />

      {/* Page header */}
      <div className="detail-header">
        <div className="detail-header-inner">
          <Link to="/dashboard" className="detail-back">
            <ArrowLeft size={14} /> All Campaigns
          </Link>

          <div className="detail-title-row flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5 md:gap-3">
                {/* Gradient dot */}
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: campaign.coverGradient,
                    flexShrink: 0,
                  }}
                />
                <h1 className="detail-title break-words text-[1.75rem] leading-[1.1] md:text-[2.125rem]">
                  {campaign.name}
                </h1>
                <StatusBadge status={finalized ? "finalized" : isActiveNow ? "active" : "closed"} />
                <span
                  className="w-fit rounded-md bg-[var(--gray-100)] px-2 py-[3px] text-[11px] font-semibold text-[var(--gray-500)]"
                  style={{
                    lineHeight: 1,
                  }}
                >
                  {campaign.category}
                </span>
              </div>
              <p className="detail-creator mt-1 break-words text-[12px] leading-6 md:text-[13px]">
                Created by <span className="break-all">{campaign.creatorAddress}</span>
                <span className="hidden md:inline"> · </span>
                <span className="block md:inline">
                  {new Date(campaign.deadline).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </p>
            </div>
          </div>

          {/* Description */}
          <p
            className="mt-3 max-w-full break-words text-[13px] leading-[1.6] text-[var(--gray-500)] md:max-w-[680px]"
            style={{
              overflowWrap: "anywhere",
            }}
          >
            {campaign.description}
          </p>
        </div>
      </div>

      {/* Metadata Section */}
      {campaign.metadata && (
        <div className="detail-body">
          <MetadataSection metadata={campaign.metadata} />
        </div>
      )}

      {/* Body */}
      <div className="detail-body">
        {/* Overview stats */}
        <CampaignOverview campaign={displayCampaign} finalized={finalized} />

        {/* Action bar */}
        {!finalized && (
          <ActionBar
            finalized={finalized}
            isSyncing={isSyncing}
            syncDisabled={syncBlocked}
            finalizeDisabled={finalizeBlocked}
            syncDisabledReason={syncDisabledReason}
            finalizeDisabledReason={finalizeDisabledReason}
            onSyncViews={handleSyncViews}
            onFinalize={handleFinalize}
          />
        )}

        {actionError && (
          <div
            style={{
              color: "#ef4444",
              fontSize: 13,
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              padding: "12px 14px",
              borderRadius: 12,
            }}
          >
            {actionError}
          </div>
        )}

        {actionInfo && (
          <div
            style={{
              color: "#0f766e",
              fontSize: 13,
              background: "rgba(20, 184, 166, 0.08)",
              border: "1px solid rgba(20, 184, 166, 0.2)",
              padding: "12px 14px",
              borderRadius: 12,
            }}
          >
            {actionInfo}
          </div>
        )}

        {/* Submissions list */}
        <SubmissionList
          submissions={displayedSubmissions}
          finalized={finalized}
          onClaim={handleClaim}
          claimPendingId={claimPendingId}
        />

        {/* Add submission form */}
        <AddSubmissionForm
          disabled={addSubmissionDisabled}
          submitting={isSubmitting}
          submitHint={submitHint}
          onAdd={handleAddSubmission}
        />
      </div>
    </div>
  );
}
