import type { UploadResult, ContractDetails } from "../types";

interface ContractDetailsFormProps {
  uploadResult: UploadResult;
  onSubmit: (details: ContractDetails) => void;
}

export default function ContractDetailsForm({ uploadResult: _uploadResult, onSubmit: _onSubmit }: ContractDetailsFormProps) {
  return <div>ContractDetails placeholder</div>;
}
