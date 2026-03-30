import type { RiskSummary } from "../types";

interface RiskSummaryCardProps {
  summary: RiskSummary;
}

export default function RiskSummaryCard({ summary: _s }: RiskSummaryCardProps) {
  return <div>RiskSummary placeholder</div>;
}
