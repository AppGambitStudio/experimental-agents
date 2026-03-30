import type { Finding } from "../types";

const SEVERITY_STYLES: Record<Finding["severity"], { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  high: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  medium: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  low: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
};

const BADGE_STYLES: Record<Finding["severity"], string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-blue-100 text-blue-700",
};

interface FindingCardProps {
  finding: Finding;
}

export default function FindingCard({ finding }: FindingCardProps) {
  const style = SEVERITY_STYLES[finding.severity];

  return (
    <div className={`rounded-lg border ${style.border} ${style.bg} px-4 py-3`}>
      <div className="flex items-start gap-2">
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase ${BADGE_STYLES[finding.severity]}`}>
          {finding.severity}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium ${style.text}`}>{finding.title}</p>
            {finding.clause && (
              <span className="text-xs text-gray-500 shrink-0">{finding.clause}</span>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-0.5">{finding.summary}</p>
        </div>
      </div>
    </div>
  );
}
