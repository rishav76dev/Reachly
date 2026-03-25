import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { signTransaction as freighterSignTransaction } from "@stellar/freighter-api";
import { Plus } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { CampaignCard } from "@/components/dashboard/CampaignCard";
import {
  campaignsQueryKey,
  createCampaignTx,
  contractAddress,
  saveCampaignName,
  useCampaigns,
} from "../lib/campaigns";
import { useStellarWallet } from "@/web3/stellarWallet";

type BrowseStatusFilter = "all" | "active" | "closed" | "other";

const STATUS_FILTERS: { label: string; value: BrowseStatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Closed", value: "closed" },
  { label: "Other", value: "other" },
];

const DURATION_OPTIONS = [
  { label: "2 minutes", value: "2" },
  { label: "3 minutes", value: "3" },
  { label: "5 minutes", value: "5" },
  { label: "10 minutes", value: "10" },
] as const;

export function Dashboard() {
  const [statusFilter, setStatusFilter] = useState<BrowseStatusFilter>("active");
  const [createFeedback, setCreateFeedback] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [budgetEth, setBudgetEth] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<
    (typeof DURATION_OPTIONS)[number]["value"]
  >("2");
  const [isCreating, setIsCreating] = useState(false);
  const { address, connect, isConnected, isSupportedNetwork, expectedNetwork } =
    useStellarWallet();
  const queryClient = useQueryClient();
  const { data: campaigns = [], isLoading, isError, error } = useCampaigns();

  const filtered = campaigns.filter((campaign) => {
    const matchStatus =
      statusFilter === "all"
      || campaign.status === statusFilter
      || (statusFilter === "other" && campaign.status !== "active" && campaign.status !== "closed");

    return matchStatus;
  });

  function handleCreateCampaignClick() {
    if (!isConnected) {
      setCreateFeedback(
        "Connect your wallet first. Creating a campaign sends an on-chain transaction from your wallet.",
      );
      setShowCreateForm(false);
      void connect();
      return;
    }

    if (!contractAddress) {
      setCreateFeedback(
        "Contract is not configured. Set VITE_CONTRACT_ADDRESS and VITE_RPC_URL before creating campaigns.",
      );
      setShowCreateForm(false);
      return;
    }

    if (!isSupportedNetwork) {
      setCreateFeedback(
        `Switch your wallet to Stellar ${expectedNetwork} before creating a campaign.`,
      );
      setShowCreateForm(false);
      return;
    }

    setCreateFeedback(
      "The contract currently stores only budget and deadline. Name, description, and category still need off-chain metadata if you want them.",
    );
    setShowCreateForm((current) => !current);
  }

  async function handleCreateCampaignSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isConnected) {
      setCreateFeedback("Connect a wallet before creating a campaign.");
      return;
    }

    if (!address) {
      setCreateFeedback("Wallet address is unavailable. Reconnect Freighter and try again.");
      return;
    }

    if (!isSupportedNetwork) {
      setCreateFeedback(`Switch to Stellar ${expectedNetwork} before creating a campaign.`);
      return;
    }

    if (!contractAddress) {
      setCreateFeedback("Contract is not configured. Set VITE_CONTRACT_ADDRESS and VITE_RPC_URL.");
      return;
    }

    const normalizedName = campaignName.trim();
    const normalizedBudget = budgetEth.trim();
    const normalizedMinutes = Number(durationMinutes);

    if (!normalizedName) {
      setCreateFeedback("Enter a campaign name.");
      return;
    }

    if (!normalizedBudget) {
      setCreateFeedback("Enter a campaign budget in XLM.");
      return;
    }

    if (!Number.isFinite(normalizedMinutes) || normalizedMinutes <= 0) {
      setCreateFeedback("Select a campaign duration of 2, 3, 5, or 10 minutes.");
      return;
    }

    if (!/^\d*\.?\d+$/.test(normalizedBudget)) {
      setCreateFeedback("Budget must be a valid XLM amount.");
      return;
    }

    if (Number(normalizedBudget) <= 0) {
      setCreateFeedback("Budget must be greater than 0 XLM.");
      return;
    }

    const durationSeconds = BigInt(normalizedMinutes * 60);

    if (durationSeconds <= 0n) {
      setCreateFeedback("Select a valid campaign duration.");
      return;
    }

    setIsCreating(true);
    setCreateFeedback(null);

    try {
      const campaignId = await createCampaignTx({
        name: normalizedName,
        brand: address,
        durationSeconds: Number(durationSeconds),
        budgetXlm: normalizedBudget,
        signTransaction: freighterSignTransaction,
      });

      saveCampaignName(campaignId, normalizedName);
      await queryClient.invalidateQueries({ queryKey: campaignsQueryKey });
      setCampaignName("");
      setBudgetEth("");
      setDurationMinutes("2");
      setShowCreateForm(false);
      setCreateFeedback(`Campaign #${campaignId} created successfully.`);
    } catch (createError) {
      setCreateFeedback(
        createError instanceof Error ? createError.message : String(createError),
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="dash-page">
      <Navbar />

      <div className="dash-header">
        <div className="dash-header-inner">
          <div>
            <h1 className="dash-title">Campaigns</h1>
            <p className="dash-subtitle">
              Filter opportunities by status and track live campaign activity
            </p>
          </div>
          <button
            onClick={handleCreateCampaignClick}
            title={
              !isConnected
                ? "Connect your wallet to create a campaign"
                : "Create campaign"
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: "var(--black)",
              color: "var(--white)",
              cursor: "pointer",
            }}
          >
            <Plus size={16} />
            Create Campaign
          </button>
        </div>
      </div>

      <div className="dash-body">
        {createFeedback && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--white)",
              color: "var(--gray-500)",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {createFeedback}
          </div>
        )}

        {showCreateForm && (
          <div
            style={{
              marginBottom: 16,
              padding: "18px",
              borderRadius: 16,
              border: "1px solid var(--border)",
              background: "var(--white)",
            }}
          >
            <form
              onSubmit={handleCreateCampaignSubmit}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                alignItems: "end",
              }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-500)" }}>
                  Campaign name
                </span>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Stellar Creator Sprint"
                  disabled={isCreating}
                  maxLength={80}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 14,
                    outline: "none",
                    background: "var(--white)",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-500)" }}>
                  Budget (XLM)
                </span>
                <input
                  type="text"
                  value={budgetEth}
                  onChange={(e) => setBudgetEth(e.target.value)}
                  placeholder="0.50"
                  disabled={isCreating}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 14,
                    outline: "none",
                    background: "var(--white)",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-500)" }}>
                  Duration
                </span>
                <select
                  value={durationMinutes}
                  onChange={(e) =>
                    setDurationMinutes(
                      e.target.value as (typeof DURATION_OPTIONS)[number]["value"],
                    )
                  }
                  disabled={isCreating}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 14,
                    outline: "none",
                    background: "var(--white)",
                  }}
                >
                  {DURATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="submit"
                  disabled={isCreating}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    padding: "10px 18px",
                    borderRadius: 10,
                    border: "none",
                    background: "var(--black)",
                    color: "var(--white)",
                    cursor: isCreating ? "not-allowed" : "pointer",
                    opacity: isCreating ? 0.6 : 1,
                  }}
                >
                  {isCreating ? "Creating..." : "Create On-Chain"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  disabled={isCreating}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 600,
                    padding: "10px 18px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--white)",
                    color: "var(--black)",
                    cursor: isCreating ? "not-allowed" : "pointer",
                    opacity: isCreating ? 0.6 : 1,
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 6, minWidth: 200 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-500)" }}>
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as BrowseStatusFilter)}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--black)",
                background: "var(--white)",
                outline: "none",
              }}
            >
              {STATUS_FILTERS.map(({ label, value }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-500)" }}>
          Showing {filtered.length} of {campaigns.length} campaign
          {campaigns.length !== 1 ? "s" : ""}
        </div>

        {!contractAddress ? (
          <div
            style={{
              textAlign: "center",
              padding: "64px 24px",
              color: "var(--gray-500)",
              fontSize: 14,
              background: "var(--white)",
              borderRadius: 16,
              border: "1px solid var(--border)",
            }}
          >
            Set <code>VITE_CONTRACT_ADDRESS</code> and <code>VITE_RPC_URL</code> to load campaigns
            from the contract.
          </div>
        ) : isLoading ? (
          <div
            style={{
              textAlign: "center",
              padding: "64px 24px",
              color: "var(--gray-400)",
              fontSize: 14,
              background: "var(--white)",
              borderRadius: 16,
              border: "1px solid var(--border)",
            }}
          >
            Loading campaigns from chain...
          </div>
        ) : isError ? (
          <div
            style={{
              textAlign: "center",
              padding: "64px 24px",
              color: "#ef4444",
              fontSize: 14,
              background: "var(--white)",
              borderRadius: 16,
              border: "1px solid var(--border)",
            }}
          >
            Failed to load campaigns: {error instanceof Error ? error.message : String(error)}
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "64px 24px",
              color: "var(--gray-400)",
              fontSize: 14,
              background: "var(--white)",
              borderRadius: 16,
              border: "1px solid var(--border)",
            }}
          >
            No campaigns match your filters.
          </div>
        ) : (
          <div className="campaign-grid">
            {filtered.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
