import { useNavigate } from "react-router-dom";
import type { Campaign } from "@/types";
import { getTotalViews } from "@/lib/campaigns";

function fmtCompact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  if (value >= 1) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function formatDue(deadlineIso: string): string {
  const due = new Date(deadlineIso).getTime();
  const now = Date.now();
  const diffMs = due - now;

  if (!Number.isFinite(due) || diffMs <= 0) {
    return "Closed";
  }

  const minutes = Math.ceil(diffMs / (1000 * 60));

  if (minutes < 60) {
    return `Due in ${minutes}m`;
  }

  const hours = Math.ceil(minutes / 60);
  if (hours < 24) {
    return `Due in ${hours}h`;
  }

  const days = Math.ceil(hours / 24);
  return `Due in ${days}d`;
}

function creatorLabel(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length <= 18) {
    return trimmed;
  }

  return `${trimmed.slice(0, 8)}...${trimmed.slice(-6)}`;
}

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "CP";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "CP";
}

interface Props {
  campaign: Campaign;
}

export function CampaignCard({ campaign }: Props) {
  const navigate = useNavigate();
  const totalSubmissions = campaign.submissionCount ?? campaign.submissions.length;
  const totalViews = campaign.totalViews ?? getTotalViews(campaign);
  const reward = fmtCompact(campaign.totalBudget);
  const dueLabel = formatDue(campaign.deadline);
  const isActive = campaign.status === "active";
  const imageUrl = campaign.metadata?.imageUrl;
  const tags = campaign.metadata?.tags ?? [];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/dashboard/${campaign.id}`)}
      onKeyDown={(e) =>
        e.key === "Enter" && navigate(`/dashboard/${campaign.id}`)
      }
      className="dash-campaign-card-shell w-full cursor-pointer focus:outline-none"
    >
      <div className="dash-campaign-card">
        <div className="dash-campaign-left">
          <div
            className="dash-campaign-thumb"
            style={
              imageUrl
                ? { backgroundImage: `url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                : { background: campaign.coverGradient }
            }
            aria-hidden="true"
          >
            {!imageUrl && <span>{initialsFromName(campaign.name)}</span>}
          </div>

          <div className="dash-campaign-copy">
            <h3 className="dash-campaign-title">{campaign.name}</h3>
            <p className="dash-campaign-creator">{creatorLabel(campaign.creatorAddress)}</p>

            {tags.length > 0 && (
              <div className="flex gap-1 flex-wrap mb-2">
                {tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-1 rounded-full bg-slate-200 text-slate-700"
                  >
                    {tag}
                  </span>
                ))}
                {tags.length > 3 && (
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                    +{tags.length - 3}
                  </span>
                )}
              </div>
            )}

            <div className="dash-campaign-meta-row">
              <span>{campaign.category || "Other"}</span>
              <span>|</span>
              <span>{dueLabel}</span>
              <span>|</span>
              <span>{totalSubmissions}</span>
              <span>{totalSubmissions === 1 ? "submission" : "submissions"}</span>
              {isActive ? <span className="dash-campaign-live-dot" aria-hidden="true" /> : null}
              <span className="dash-campaign-status">{campaign.status.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div className="dash-campaign-right" aria-label={`Campaign budget ${campaign.totalBudget} XLM`}>
          <span className="dash-campaign-coin">$</span>
          <strong>{reward}</strong>
          <span className="dash-campaign-unit">XLM</span>
          <span className="dash-campaign-views">{fmtCompact(totalViews)} views</span>
        </div>
      </div>
    </div>
  );
}
