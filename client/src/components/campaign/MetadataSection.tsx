import { CheckCircle2, FileText } from "lucide-react";
import type { CampaignMetadata } from "@/types";

interface Props {
  metadata?: CampaignMetadata;
}

export function MetadataSection({ metadata }: Props) {
  if (!metadata) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Banner Image */}
      {metadata.imageUrl && (
        <div className="rounded-lg overflow-hidden border border-slate-200">
          <img
            src={metadata.imageUrl}
            alt="Campaign banner"
            className="w-full h-64 object-cover"
          />
        </div>
      )}

      {/* Full Description */}
      {metadata.fullDescription && (
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h3 className="font-semibold text-sm mb-2 text-slate-900">About This Campaign</h3>
          <p className="text-sm text-slate-700 leading-relaxed">{metadata.fullDescription}</p>
        </div>
      )}

      {/* Community & Social */}
      {(metadata.community || metadata.socialHandle) && (
        <div className="grid grid-cols-2 gap-4">
          {metadata.community && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-xs font-medium text-blue-600 mb-1">Community</p>
              <p className="text-sm font-semibold text-slate-900">{metadata.community}</p>
            </div>
          )}
          {metadata.socialHandle && (
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <p className="text-xs font-medium text-purple-600 mb-1">Follow</p>
              <p className="text-sm font-semibold text-slate-900">{metadata.socialHandle}</p>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {metadata.tags && metadata.tags.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-3 text-slate-900">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {metadata.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Eligibility */}
      {metadata.eligibility && metadata.eligibility.length > 0 && (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={18} className="text-green-600" />
            <h3 className="font-semibold text-sm text-slate-900">Eligibility Requirements</h3>
          </div>
          <ul className="space-y-2">
            {metadata.eligibility.map((req, idx) => (
              <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Submission Requirements */}
      {metadata.submissionRequirements && metadata.submissionRequirements.length > 0 && (
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={18} className="text-amber-600" />
            <h3 className="font-semibold text-sm text-slate-900">Submission Guidelines</h3>
          </div>
          <ul className="space-y-2">
            {metadata.submissionRequirements.map((req, idx) => (
              <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                <span className="text-amber-600 mt-1">•</span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Additional Info */}
      {(metadata.maxSubmissionsPerUser || metadata.verificationMethod) && (
        <div className="grid grid-cols-2 gap-4">
          {metadata.maxSubmissionsPerUser && (
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
              <p className="text-xs font-medium text-indigo-600 mb-1">Max Submissions</p>
              <p className="text-sm font-semibold text-slate-900">
                {metadata.maxSubmissionsPerUser} per user
              </p>
            </div>
          )}
          {metadata.verificationMethod && (
            <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
              <p className="text-xs font-medium text-cyan-600 mb-1">Verification</p>
              <p className="text-sm font-semibold text-slate-900 capitalize">
                {metadata.verificationMethod.replace(/-/g, " ")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
