import { Coins, Clock, Users, Eye, Zap } from "lucide-react";
import type { Campaign } from "@/types";
import { getTotalViews } from "@/lib/campaigns";

interface Props {
  campaign: Campaign;
  finalized: boolean;
}

export function CampaignOverview({ campaign, finalized }: Props) {
  const totalViews = campaign.totalViews ?? getTotalViews(campaign);
  const deadlineMs = campaign.deadlineUnix
    ? campaign.deadlineUnix * 1000
    : new Date(campaign.deadline).getTime();
  const remainingMs = deadlineMs - Date.now();
  const distributed = finalized
    ? campaign.submissions.reduce((a, s) => a + s.reward, 0)
    : 0;

  let deadlineText = "Campaign ended";

  if (campaign.status !== "closed" && Number.isFinite(remainingMs)) {
    if (remainingMs <= 0) {
      deadlineText = "Campaign ended";
    } else if (remainingMs < 60 * 60 * 1000) {
      const minutes = Math.ceil(remainingMs / (1000 * 60));
      deadlineText = `Ends in ${minutes}m`;
    } else if (remainingMs < 24 * 60 * 60 * 1000) {
      const hours = Math.ceil(remainingMs / (1000 * 60 * 60));
      deadlineText = `Ends in ${hours}h`;
    } else {
      const days = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
      deadlineText = `${days} day${days === 1 ? "" : "s"} left`;
    }
  }

  const items = [
    {
      label: "Total Budget",
      value: `${campaign.totalBudget} XLM`,
      icon: Coins,
      lime: false,
    },
    {
      label: "Time Remaining",
      value: deadlineText,
      icon: Clock,
      lime: false,
    },
    {
      label: "Submissions",
      value: (campaign.submissionCount ?? campaign.submissions.length).toString(),
      icon: Users,
      lime: false,
    },
    {
      label: "Total Views",
      value: totalViews.toLocaleString(),
      icon: Eye,
      lime: false,
    },
    {
      label: "Distributed",
      value: finalized ? `${distributed.toFixed(4)} XLM` : "—",
      icon: Zap,
      lime: finalized,
    },
  ];

  return (
    <div className="overview-stats">
      {items.map(({ label, value, icon: Icon, lime }) => (
        <div key={label} className="overview-stat-shell">
          <div className="overview-stat">
            <div className="overview-stat-label">
              <Icon size={11} style={{ display: "inline", marginRight: 4 }} />
              {label}
            </div>
            <div className={`overview-stat-value${lime ? " lime" : ""}`}>{value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
