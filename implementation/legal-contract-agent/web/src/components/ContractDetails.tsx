import { useState } from "react";
import type { UploadResult, ContractDetails } from "../types";

interface ContractDetailsFormProps {
  uploadResult: UploadResult;
  onSubmit: (details: ContractDetails) => void;
}

const ROLES = ["Vendor", "Client", "Developer", "Employer", "Tenant"];
const CONTRACT_TYPES = ["MSA", "NDA", "Employment", "Freelancer", "Lease", "SOW", "Service Agreement"];
const STATES = ["Gujarat", "Maharashtra", "Delhi", "Karnataka"];

export default function ContractDetailsForm({ uploadResult, onSubmit }: ContractDetailsFormProps) {
  const [counterparty, setCounterparty] = useState("");
  const [ourRole, setOurRole] = useState("");
  const [contractType, setContractType] = useState("");
  const [state, setState] = useState("Gujarat");
  const [contractValue, setContractValue] = useState("");

  const canSubmit = counterparty.trim() && ourRole && contractType;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      fileId: uploadResult.fileId,
      counterparty: counterparty.trim(),
      contractType,
      ourRole,
      state,
      contractValue: contractValue ? Number(contractValue) : undefined,
    });
  };

  return (
    <div className="max-w-lg mx-auto py-8">
      {/* File summary */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{uploadResult.fileName}</p>
            <p className="text-xs text-gray-500">
              {uploadResult.pageCount} pages &middot; {uploadResult.wordCount.toLocaleString()} words &middot; {uploadResult.chunks} chunks
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Counterparty */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Counterparty</label>
          <input
            type="text"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder="e.g. Acme Corp, John Doe"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Our Role */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Role</label>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setOurRole(role)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  ourRole === role
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Contract Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Contract Type</label>
          <div className="flex flex-wrap gap-2">
            {CONTRACT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setContractType(type)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  contractType === type
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* State */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Governing State</label>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          >
            {STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Contract Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Contract Value <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">Rs</span>
            <input
              type="number"
              value={contractValue}
              onChange={(e) => setContractValue(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full rounded-lg bg-indigo-600 text-white py-2.5 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start Analysis
        </button>
      </div>
    </div>
  );
}
