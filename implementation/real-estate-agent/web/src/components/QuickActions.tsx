const ACTIONS = [
  { label: "Summary", command: "/summary" },
  { label: "Red Flags", command: "/risks" },
  { label: "Total Cost", command: "/cost" },
  { label: "Full Report", command: "/dossier" },
  { label: "All Commands", command: "/help" },
];

interface QuickActionsProps {
  onAction: (command: string) => void;
}

export default function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2 px-2 py-2">
      {ACTIONS.map((a) => (
        <button
          key={a.command}
          type="button"
          onClick={() => onAction(a.command)}
          className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition-colors font-medium"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
