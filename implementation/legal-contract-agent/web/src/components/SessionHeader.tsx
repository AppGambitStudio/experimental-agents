interface SessionHeaderProps {
  fileName: string;
  pageCount: number;
  counterparty: string;
  contractType: string;
  ourRole: string;
}

export default function SessionHeader({ fileName: _fn, pageCount: _pc, counterparty: _cp, contractType: _ct, ourRole: _or }: SessionHeaderProps) {
  return <div>SessionHeader placeholder</div>;
}
