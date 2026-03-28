import type { WizardData } from "../types";

interface SessionHeaderProps {
  data: WizardData;
}

const formatBudget = (val: number) => {
  if (val >= 10000000) return `Rs ${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `Rs ${(val / 100000).toFixed(2)} L`;
  return `Rs ${val.toLocaleString("en-IN")}`;
};

export default function SessionHeader({ data }: SessionHeaderProps) {
  const items = [
    data.address,
    data.propertyType,
    formatBudget(data.budget),
    data.builderName,
  ].filter(Boolean);

  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-2 mb-4">
      <p className="text-sm text-gray-600 truncate">
        {items.join(" | ")}
      </p>
    </div>
  );
}
