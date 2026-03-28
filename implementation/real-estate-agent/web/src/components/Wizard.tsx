import { useState } from "react";
import type { WizardData } from "../types";
import WizardStep from "./WizardStep";

const PROPERTY_TYPES = [
  { value: "flat", label: "Flat", icon: "\ud83c\udfe2" },
  { value: "plot", label: "Plot", icon: "\ud83c\udfd7\ufe0f" },
  { value: "row_house", label: "Row House", icon: "\ud83c\udfe0" },
  { value: "villa", label: "Villa", icon: "\ud83c\udfe1" },
  { value: "commercial", label: "Commercial", icon: "\ud83c\udfdb\ufe0f" },
];

const CONCERNS = [
  { value: "all", label: "All (comprehensive)" },
  { value: "builder", label: "Builder reputation" },
  { value: "legal", label: "Legal & title" },
  { value: "cost", label: "Cost analysis" },
];

interface WizardProps {
  onSubmit: (data: WizardData) => void;
}

export default function Wizard({ onSubmit }: WizardProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({
    address: "",
    state: "Gujarat",
    city: "Surat",
    propertyType: "",
    budget: 0,
    builderName: "",
    reraId: "",
    primaryConcern: "all",
  });

  const update = <K extends keyof WizardData>(key: K, value: WizardData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const canNext = () => {
    if (step === 0) return data.address.trim().length > 0;
    if (step === 1) return data.propertyType !== "" && data.budget > 0;
    return true;
  };

  const handleSubmit = () => {
    if (canNext()) onSubmit(data);
  };

  const formatBudget = (val: number) => {
    if (val >= 10000000) return `Rs ${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `Rs ${(val / 100000).toFixed(2)} L`;
    return `Rs ${val.toLocaleString("en-IN")}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Progress bar */}
      <div className="flex gap-2 mb-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i <= step ? "bg-indigo-600" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {step === 0 && (
        <WizardStep title="Location" subtitle="Where is the property located?">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address / Project Name
              </label>
              <input
                type="text"
                value={data.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="e.g. Green Valley Heights, Vesu"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <select
                value={data.state}
                onChange={(e) => update("state", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="Gujarat">Gujarat</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={data.city}
                onChange={(e) => update("city", e.target.value)}
                placeholder="e.g. Surat"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </WizardStep>
      )}

      {step === 1 && (
        <WizardStep
          title="Property Details"
          subtitle="What kind of property are you looking at?"
        >
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Property Type
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {PROPERTY_TYPES.map((pt) => (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => update("propertyType", pt.value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border-2 px-3 py-3 text-sm transition-colors ${
                      data.propertyType === pt.value
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    }`}
                  >
                    <span className="text-2xl">{pt.icon}</span>
                    <span className="font-medium">{pt.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Budget (Rs)
              </label>
              <input
                type="number"
                value={data.budget || ""}
                onChange={(e) => update("budget", Number(e.target.value))}
                placeholder="e.g. 5000000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {data.budget > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {formatBudget(data.budget)}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Builder Name{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={data.builderName}
                onChange={(e) => update("builderName", e.target.value)}
                placeholder="e.g. Adani Realty"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </WizardStep>
      )}

      {step === 2 && (
        <WizardStep
          title="RERA & Priorities"
          subtitle="Any RERA details? What should we focus on?"
        >
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RERA ID{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={data.reraId}
                onChange={(e) => update("reraId", e.target.value)}
                placeholder="e.g. PR/GJ/SURAT/SURAT CITY/..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">
                Find it on{" "}
                <a
                  href="https://gujrera.gujarat.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-500 underline"
                >
                  gujrera.gujarat.gov.in
                </a>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Primary Concern
              </label>
              <div className="space-y-2">
                {CONCERNS.map((c) => (
                  <label
                    key={c.value}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                      data.primaryConcern === c.value
                        ? "border-indigo-600 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="concern"
                      value={c.value}
                      checked={data.primaryConcern === c.value}
                      onChange={(e) => update("primaryConcern", e.target.value)}
                      className="accent-indigo-600"
                    />
                    <span className="text-sm text-gray-700">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </WizardStep>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          className={`px-4 py-2 text-sm font-medium rounded-lg ${
            step === 0
              ? "invisible"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          Back
        </button>
        {step < 2 ? (
          <button
            type="button"
            onClick={() => canNext() && setStep((s) => s + 1)}
            disabled={!canNext()}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Start Verification
          </button>
        )}
      </div>
    </div>
  );
}
