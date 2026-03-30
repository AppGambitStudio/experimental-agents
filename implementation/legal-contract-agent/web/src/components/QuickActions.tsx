const ACTIONS = [
  { label: "Red Flags", command: "/risks" },
  { label: "Negotiation", command: "/playbook" },
  { label: "Redline", command: "/redline" },
  { label: "Stamp Duty", command: "/stamp-duty" },
  { label: "Checklist", command: "/checklist" },
  { label: "Full Report", command: "/dossier" },
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
