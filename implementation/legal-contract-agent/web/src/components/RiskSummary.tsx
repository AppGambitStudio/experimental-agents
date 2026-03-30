import type { RiskSummary } from "../types";

interface RiskSummaryCardProps {
  summary: RiskSummary;
}

const gradeColor = (grade: string): string => {
  switch (grade) {
    case "A": return "text-green-600 bg-green-50 border-green-200";
    case "B": return "text-blue-600 bg-blue-50 border-blue-200";
    case "C": return "text-yellow-600 bg-yellow-50 border-yellow-200";
    case "D": return "text-orange-600 bg-orange-50 border-orange-200";
    case "F": return "text-red-600 bg-red-50 border-red-200";
    default: return "text-gray-600 bg-gray-50 border-gray-200";
  }
};

export default function RiskSummaryCard({ summary }: RiskSummaryCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-4">
      <div className="flex items-center gap-4">
        {/* Score + Grade */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${gradeColor(summary.grade)}`}>
          <span className="text-2xl font-bold">{summary.grade}</span>
          <span className="text-sm font-medium">{summary.score}/100</span>
        </div>

        {/* Severity counts */}
        <div className="flex items-center gap-2">
          {summary.critical > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              {summary.critical} Critical
            </span>
          )}
          {summary.high > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
              {summary.high} High
            </span>
          )}
          {summary.medium > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
              {summary.medium} Medium
            </span>
          )}
          {summary.low > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
              {summary.low} Low
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
