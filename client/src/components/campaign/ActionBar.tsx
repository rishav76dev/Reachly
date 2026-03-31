import { RefreshCw, Lock, CheckCircle } from "lucide-react";

interface Props {
  finalized: boolean;
  isSyncing?: boolean;
  syncDisabled?: boolean;
  finalizeDisabled?: boolean;
  syncLabel?: string;
  helperText?: string;
  syncDisabledReason?: string;
  finalizeDisabledReason?: string;
  onSyncViews: () => void;
  onFinalize: () => void;
}

export function ActionBar({
  finalized,
  isSyncing = false,
  syncDisabled = false,
  finalizeDisabled = false,
  syncLabel = "Sync Views",
  helperText = "Sync Views refreshes worker estimates only. Finalize Distribution writes views on-chain and locks rewards.",
  syncDisabledReason,
  finalizeDisabledReason,
  onSyncViews,
  onFinalize,
}: Props) {
  return (
    <div className="action-bar-shell">
      <div className="action-bar">
        <div className="action-bar-left">
          {!finalized ? (
            <>
              <button
                className="btn btn-outline btn-sm"
                onClick={onSyncViews}
                disabled={syncDisabled || isSyncing}
                title={syncDisabledReason}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "1.5px solid var(--border)",
                  background: "var(--white)",
                  color: "var(--black)",
                  cursor: syncDisabled || isSyncing ? "not-allowed" : "pointer",
                  opacity: syncDisabled || isSyncing ? 0.6 : 1,
                  transition: "all 150ms",
                }}
              >
                <RefreshCw size={14} />
                {isSyncing ? "Syncing..." : syncLabel}
              </button>

              <button
                onClick={onFinalize}
                disabled={finalizeDisabled || isSyncing}
                title={finalizeDisabledReason}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "1.5px solid var(--black)",
                  background: "var(--black)",
                  color: "var(--white)",
                  cursor: finalizeDisabled || isSyncing ? "not-allowed" : "pointer",
                  opacity: finalizeDisabled || isSyncing ? 0.6 : 1,
                  transition: "all 150ms",
                }}
              >
                <Lock size={14} />
                Finalize Distribution
              </button>
            </>
          ) : (
            <div className="finalized-banner">
              <CheckCircle size={16} />
              Distribution finalized — rewards locked and ready to claim.
            </div>
          )}
        </div>

        {!finalized && (
          <p className="action-bar-status">
            {finalizeDisabledReason ?? syncDisabledReason ?? helperText}
          </p>
        )}
      </div>
    </div>
  );
}
