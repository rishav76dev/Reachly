import { useState } from "react";
import { Plus, Link2 } from "lucide-react";
import { extractTweetId } from "@/lib/utils";

interface Props {
  disabled: boolean;
  submitting?: boolean;
  submitHint?: string;
  submitError?: string | null;
  campaignName?: string;
  existingTweetLinks?: string[];
  onAdd: (tweetLink: string) => void;
}

export function AddSubmissionForm({
  disabled,
  submitting = false,
  submitHint,
  submitError,
  campaignName,
  existingTweetLinks = [],
  onAdd,
}: Props) {
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
 
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedLink = link.trim();

    if (!trimmedLink) {
      setError("Tweet link is required.");
      return;
    }

    const hasValidDomain =
      trimmedLink.includes("x.com") || trimmedLink.includes("twitter.com");
    if (!hasValidDomain) {
      setError("Please enter a valid X / Twitter URL.");
      return;
    }

    const tweetId = extractTweetId(trimmedLink);
    if (!tweetId) {
      setError("Tweet URL must include a valid status ID.");
      return;
    }

    const normalizedLink = trimmedLink.toLowerCase();
    const isDuplicate = existingTweetLinks.some(
      (existing) => existing.toLowerCase() === normalizedLink,
    );
    if (isDuplicate) {
      setError("This tweet has already been submitted to this campaign.");
      return;
    }

    onAdd(trimmedLink);
    setLink("");
  }

  const validationHint = campaignName
    ? `Tweet must mention or reference "${campaignName}" for this campaign.`
    : null;
  const displayError = error || submitError;

  return (
    <div className="add-submission-shell">
      <div className="add-submission-form">
        <div className="add-submission-form-title">
          <Link2 size={14} style={{ display: "inline", marginRight: 6 }} />
          Add Submission
        </div>

        <form onSubmit={handleSubmit}>
          <div className="add-submission-row">
            <input
              type="url"
              className="input"
              placeholder="https://x.com/user/status/..."
              value={link}
              onChange={(e) => setLink(e.target.value)}
              disabled={disabled || submitting}
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              disabled={disabled || submitting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                padding: "0 18px",
                borderRadius: 10,
                border: "none",
                background: "var(--black)",
                color: "var(--white)",
                cursor: disabled || submitting ? "not-allowed" : "pointer",
                opacity: disabled || submitting ? 0.5 : 1,
                whiteSpace: "nowrap",
                height: 40,
                flexShrink: 0,
              }}
            >
              <Plus size={14} />
              {submitting ? "Submitting..." : "Add"}
            </button>
          </div>
          {displayError && (
            <p style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>{displayError}</p>
          )}
          {!displayError && validationHint && (
            <p style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 8 }}>
              {validationHint}
            </p>
          )}
          {!displayError && !validationHint && submitHint && (
            <p style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 8 }}>
              {submitHint}
            </p>
          )}
          {disabled && (
            <p style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 8 }}>
              Distribution is finalized — no new submissions accepted.
            </p>
          )}
          
        </form>
      </div>
    </div>
  );
}
