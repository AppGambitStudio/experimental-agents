interface SessionHeaderProps {
  fileName: string;
  pageCount: number;
  counterparty: string;
  contractType: string;
  ourRole: string;
}

export default function SessionHeader({ fileName, pageCount, counterparty, contractType, ourRole }: SessionHeaderProps) {
  const items = [
    fileName,
    `${pageCount} pg`,
    counterparty,
    contractType,
    ourRole,
  ].filter(Boolean);

  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-2 mb-4">
      <p className="text-sm text-gray-600 truncate">
        {items.join(" | ")}
      </p>
    </div>
  );
}
