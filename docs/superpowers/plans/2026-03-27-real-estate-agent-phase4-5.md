# Real Estate Agent — Phase 4 (Registration Guide) & Phase 5 (Post-Purchase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Registration Guide (Phase 4) and Post-Purchase Tracking (Phase 5) to the real estate agent — step-by-step Gujarat property registration process and post-purchase formalities checklist with tracking.

**Architecture:** Two new knowledge base modules (`registration-guide.ts`, `post-purchase.ts`) provide Gujarat-specific process data. Two new MCP tools (`get_registration_guide`, `get_post_purchase_checklist`) expose them. The tracker-mcp gets a `track_checklist_item` tool for tracking completion of post-purchase tasks. The copilot system prompt is extended with Phase 4-5 workflow instructions.

**Tech Stack:** TypeScript, Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), Zod, Node built-in test runner (`node:test`)

---

## File Structure

```
implementation/real-estate-agent/src/
├── knowledge-base/
│   ├── registration-guide.ts       # NEW — Gujarat registration process data
│   ├── post-purchase.ts            # NEW — Post-purchase checklist data
│   └── negative-constraints.ts     # NEW — What the agent CANNOT verify
├── mcp-servers/
│   ├── property-kb-mcp.ts          # MODIFY — add 3 new tools (incl. get_verification_limitations)
│   └── tracker-mcp.ts              # MODIFY — add checklist tracking tool
├── copilot.ts                      # MODIFY — extend system prompt with Phase 4-5 + negative constraints
├── agent.ts                        # MODIFY — add negative constraints to due diligence report
├── types/index.ts                  # MODIFY — add new types
└── tests/
    ├── registration-guide.test.ts  # NEW — tests for registration guide
    ├── post-purchase.test.ts       # NEW — tests for post-purchase checklist
    └── negative-constraints.test.ts # NEW — tests for negative constraints
```

---

### Task 1: Add Types for Registration Guide and Post-Purchase

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add new types to types/index.ts**

Append these types after the existing `JantriRate` interface at the end of the file:

```typescript
export interface RegistrationStep {
  step: number;
  title: string;
  description: string;
  location: string;
  documentsNeeded: string[];
  estimatedTime: string;
  fees?: string;
  tips: string[];
}

export interface RegistrationGuide {
  propertyType: PropertyType;
  state: string;
  city: string;
  totalSteps: number;
  estimatedTotalTime: string;
  steps: RegistrationStep[];
  witnessRequirements: {
    count: number;
    idRequired: boolean;
    notes: string;
  };
  biometricRequirements: {
    required: boolean;
    who: string[];
    notes: string;
  };
}

export interface PostPurchaseTask {
  id: string;
  task: string;
  description: string;
  where: string;
  when: string;
  documentsNeeded: string[];
  estimatedTime: string;
  mandatory: boolean;
  category: "legal" | "municipal" | "utility" | "financial" | "personal";
}

export type ChecklistItemStatus = "pending" | "in_progress" | "completed" | "skipped" | "blocked";

export interface ChecklistItem {
  taskId: string;
  purchaseId: string;
  status: ChecklistItemStatus;
  completedAt?: string;
  notes?: string;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd implementation/real-estate-agent && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add types for registration guide and post-purchase checklist"
```

---

### Task 2: Create Registration Guide Knowledge Base

**Files:**
- Create: `src/knowledge-base/registration-guide.ts`
- Create: `src/tests/registration-guide.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tests/registration-guide.test.ts`:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getRegistrationGuide } from "../knowledge-base/registration-guide.js";

describe("getRegistrationGuide", () => {
  describe("returns guide for all property types", () => {
    const types = ["residential_flat", "commercial_office", "plot", "row_house", "villa"] as const;

    for (const type of types) {
      it(`returns guide for ${type}`, () => {
        const guide = getRegistrationGuide(type, "Surat");
        assert.ok(guide);
        assert.equal(guide.propertyType, type);
        assert.equal(guide.state, "Gujarat");
        assert.equal(guide.city, "Surat");
        assert.ok(guide.totalSteps >= 8, `expected >= 8 steps, got ${guide.totalSteps}`);
        assert.equal(guide.steps.length, guide.totalSteps);
      });
    }
  });

  describe("step completeness", () => {
    it("all steps have required fields", () => {
      const guide = getRegistrationGuide("residential_flat", "Surat");
      for (const step of guide.steps) {
        assert.ok(step.step > 0, "step number required");
        assert.ok(step.title.length > 0, "title required");
        assert.ok(step.description.length > 0, "description required");
        assert.ok(step.location.length > 0, "location required");
        assert.ok(Array.isArray(step.documentsNeeded), "documentsNeeded must be array");
        assert.ok(step.estimatedTime.length > 0, "estimatedTime required");
        assert.ok(Array.isArray(step.tips), "tips must be array");
      }
    });
  });

  describe("key steps are present", () => {
    it("includes e-stamping step", () => {
      const guide = getRegistrationGuide("residential_flat", "Surat");
      const hasEStamping = guide.steps.some(s =>
        s.title.toLowerCase().includes("stamp") || s.title.toLowerCase().includes("e-stamp")
      );
      assert.ok(hasEStamping, "should include e-stamping step");
    });

    it("includes biometric verification step", () => {
      const guide = getRegistrationGuide("residential_flat", "Surat");
      const hasBiometric = guide.steps.some(s =>
        s.title.toLowerCase().includes("biometric") || s.description.toLowerCase().includes("biometric")
      );
      assert.ok(hasBiometric, "should include biometric verification");
    });

    it("includes document preparation step", () => {
      const guide = getRegistrationGuide("residential_flat", "Surat");
      const hasDocPrep = guide.steps.some(s =>
        s.title.toLowerCase().includes("document") || s.title.toLowerCase().includes("prepare")
      );
      assert.ok(hasDocPrep, "should include document preparation step");
    });

    it("includes Sub-Registrar appointment step", () => {
      const guide = getRegistrationGuide("residential_flat", "Surat");
      const hasAppointment = guide.steps.some(s =>
        s.title.toLowerCase().includes("registrar") || s.title.toLowerCase().includes("appointment")
      );
      assert.ok(hasAppointment, "should include Sub-Registrar appointment step");
    });
  });

  describe("witness and biometric requirements", () => {
    it("requires 2 witnesses", () => {
      const guide = getRegistrationGuide("residential_flat", "Surat");
      assert.equal(guide.witnessRequirements.count, 2);
      assert.equal(guide.witnessRequirements.idRequired, true);
    });

    it("biometric required for buyer and seller", () => {
      const guide = getRegistrationGuide("residential_flat", "Surat");
      assert.equal(guide.biometricRequirements.required, true);
      assert.ok(guide.biometricRequirements.who.length >= 2);
    });
  });

  describe("defaults to Surat", () => {
    it("returns Surat guide when no city specified", () => {
      const guide = getRegistrationGuide("residential_flat");
      assert.equal(guide.city, "Surat");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd implementation/real-estate-agent && node --import tsx --test src/tests/registration-guide.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the registration guide knowledge base**

Create `src/knowledge-base/registration-guide.ts`:

```typescript
// Gujarat property registration — step-by-step guide
// Source: Gujarat Registration Act, Sub-Registrar process, e-stamping via SHCIL

import type { PropertyType, RegistrationGuide, RegistrationStep } from "../types/index.js";

const COMMON_REGISTRATION_STEPS: RegistrationStep[] = [
  {
    step: 1,
    title: "Finalize and Sign the Agreement",
    description:
      "Finalize the sale agreement with the builder/seller. Both parties must agree on the final terms including price, payment schedule, possession date, and all clauses. Get 2 copies printed on stamp paper of appropriate value.",
    location: "Advocate's office or builder's office",
    documentsNeeded: [
      "Draft sale agreement (reviewed by your advocate)",
      "Builder/seller ID proof (PAN + Aadhaar)",
      "Buyer ID proof (PAN + Aadhaar)",
      "Property documents (title deed, 7/12, 8A, RERA certificate)",
    ],
    estimatedTime: "1-2 days",
    tips: [
      "Have YOUR advocate review the agreement — do not rely on the builder's lawyer",
      "Ensure carpet area matches RERA registration exactly",
      "Check possession delay penalty is at least SBI PLR + 2% (RERA minimum)",
      "Keep a signed copy for yourself — do not give both originals to the builder",
    ],
  },
  {
    step: 2,
    title: "Pay Stamp Duty via E-Stamping",
    description:
      "Purchase e-stamp paper for the stamp duty amount from an authorized SHCIL (Stock Holding Corporation of India) center or online via the SHCIL website. Gujarat supports e-stamping — no need for physical stamp paper. Stamp duty is calculated on the higher of the agreement value or jantri (government ready reckoner) value.",
    location: "SHCIL authorized center or online at shcilestamp.com",
    documentsNeeded: [
      "PAN card of buyer",
      "Agreement details (property value, type)",
      "Payment via demand draft / NEFT / RTGS (cash not accepted for large amounts)",
    ],
    estimatedTime: "1-2 hours (online) or half day (in person)",
    fees: "Stamp duty: 3.5% (residential) or 4.9% (commercial/plot) of property value",
    tips: [
      "E-stamp certificates are valid for 6 months from date of issue",
      "Keep the original e-stamp certificate — it has a unique identification number (UIN)",
      "Verify the e-stamp is genuine at shcilestamp.com using the UIN",
      "Stamp duty is non-refundable once paid — ensure all details are correct",
    ],
  },
  {
    step: 3,
    title: "Prepare Documents for Registration",
    description:
      "Compile all documents required for Sub-Registrar registration. Both buyer and seller documents must be ready. Make photocopies of everything — the Sub-Registrar office keeps originals of certain documents.",
    location: "Home / Advocate's office",
    documentsNeeded: [
      "Original sale agreement on e-stamp paper (signed by both parties)",
      "E-stamp certificate (stamp duty receipt)",
      "PAN card — buyer and seller (original + 2 copies)",
      "Aadhaar card — buyer and seller (original + 2 copies)",
      "Passport-size photos — buyer (2) and seller (2)",
      "Original title deed of the property",
      "Latest property tax receipt (no outstanding dues)",
      "7/12 extract and 8A extract (recent, within 3 months)",
      "Encumbrance certificate (last 13+ years)",
      "RERA registration certificate (for new construction)",
      "NOC from housing society (for resale)",
      "NOC from the bank (if property has existing loan)",
      "Power of Attorney (if any party is represented by PoA holder)",
    ],
    estimatedTime: "1-2 days to compile",
    tips: [
      "Make 3 sets of photocopies of every document",
      "Carry original documents — Sub-Registrar may ask to verify any document",
      "If seller has an existing home loan, get a NOC from their bank BEFORE registration day",
      "Ensure all documents have matching names — even a spelling difference can cause delays",
    ],
  },
  {
    step: 4,
    title: "Book Sub-Registrar Appointment",
    description:
      "Book an appointment at the jurisdictional Sub-Registrar office. In Gujarat, appointments can be booked online through the GARVI portal (garvi.gujarat.gov.in) or in person. The Sub-Registrar office is determined by the property location, not the buyer's address.",
    location: "Online via GARVI portal or in person at Sub-Registrar office",
    documentsNeeded: [
      "Property details (survey number, address)",
      "Buyer and seller details",
      "Preferred date and time slot",
    ],
    estimatedTime: "15-30 minutes (online booking)",
    tips: [
      "Book at least 3-5 days in advance — popular offices fill up quickly",
      "Morning slots (10-11 AM) are recommended — less crowded",
      "Confirm the correct Sub-Registrar office for your property's jurisdiction",
      "Both buyer and seller (or their PoA holders) MUST be present on registration day",
    ],
  },
  {
    step: 5,
    title: "Registration Day — Attend Sub-Registrar Office",
    description:
      "Both buyer and seller (and 2 witnesses) attend the Sub-Registrar office with all documents. The registration clerk verifies documents, checks stamp duty payment, and prepares the deed for registration. The process involves document verification, biometric capture, and signing.",
    location: "Sub-Registrar office (as per appointment)",
    documentsNeeded: [
      "All documents from Step 3 (originals + copies)",
      "E-stamp certificate",
      "Registration fee payment (1% of property value — typically via demand draft)",
      "Witness ID proofs (Aadhaar + PAN of both witnesses)",
    ],
    estimatedTime: "2-4 hours",
    fees: "Registration fee: 1% of property value (min ₹100). Female first-time buyer: ₹10,000 discount.",
    tips: [
      "Arrive 15-20 minutes before your appointment slot",
      "Carry extra passport-size photos — some offices require additional photos",
      "Registration fee is separate from stamp duty — carry a DD or ensure NEFT is ready",
      "Do NOT leave the office without collecting the registration receipt",
    ],
  },
  {
    step: 6,
    title: "Biometric Verification",
    description:
      "All parties (buyer, seller, witnesses) undergo biometric verification — fingerprint and photograph capture. This is mandatory for registration in Gujarat. The biometric data is linked to Aadhaar for identity verification.",
    location: "Sub-Registrar office (biometric counter)",
    documentsNeeded: [
      "Aadhaar card (for biometric matching)",
      "Original ID proof (PAN + Aadhaar)",
    ],
    estimatedTime: "15-30 minutes",
    tips: [
      "Ensure your fingerprints are clean and dry — ink, cuts, or dry skin can cause failures",
      "If biometric fails after 3 attempts, you may need to provide alternative ID verification",
      "All parties must be physically present — no proxy for biometric capture",
      "If representing via Power of Attorney, the PoA holder's biometric is captured (along with original PoA)",
    ],
  },
  {
    step: 7,
    title: "Signing and Document Endorsement",
    description:
      "After document verification and biometric capture, all parties sign the sale deed in the presence of the Sub-Registrar. The Sub-Registrar endorses the document with the registration number, date, and official seal. The document is now officially registered.",
    location: "Sub-Registrar office",
    documentsNeeded: [
      "No additional documents — everything from earlier steps",
    ],
    estimatedTime: "30-60 minutes",
    tips: [
      "Read the document one final time before signing — this is your last chance",
      "Ensure the registration number is clearly visible on the endorsed document",
      "Ask for the document number — you'll need it for future reference",
      "The endorsement includes: registration number, book number, volume number, and page number",
    ],
  },
  {
    step: 8,
    title: "Collect Registration Receipt",
    description:
      "Collect the registration receipt immediately after signing. This receipt is proof that your document has been registered. The actual registered deed (with Sub-Registrar's endorsement) will be available for collection later — typically 3-7 working days.",
    location: "Sub-Registrar office (receipt counter)",
    documentsNeeded: [
      "ID proof for collection",
    ],
    estimatedTime: "10-15 minutes",
    tips: [
      "Do NOT leave without the receipt — it is your proof of registration",
      "Note the expected collection date for the registered deed",
      "Keep the receipt in a safe place — you need it to collect the registered deed",
    ],
  },
  {
    step: 9,
    title: "Collect Registered Sale Deed",
    description:
      "Return to the Sub-Registrar office on or after the collection date to pick up the registered sale deed. This is the final, legally binding document proving your ownership. Verify all details on the registered deed before leaving.",
    location: "Sub-Registrar office",
    documentsNeeded: [
      "Registration receipt",
      "ID proof (Aadhaar)",
    ],
    estimatedTime: "30-60 minutes",
    tips: [
      "Verify every detail on the registered deed: names, property description, survey number, consideration amount",
      "Immediately make 2-3 certified copies of the registered deed",
      "Store the original in a bank locker — this is the most important property document",
      "The registered deed is your primary proof of ownership for all future transactions",
    ],
  },
  {
    step: 10,
    title: "Pay Registration Fee Balance (if applicable)",
    description:
      "If there is any balance registration fee or additional charges, pay them at the Sub-Registrar's counter. Collect the final receipt. Some offices also charge a nominal scanning/digitization fee.",
    location: "Sub-Registrar office (payment counter)",
    documentsNeeded: [
      "Registration receipt",
      "Payment (DD / NEFT / cash for small amounts)",
    ],
    estimatedTime: "15-30 minutes",
    fees: "Scanning fee: ₹100-500 (varies by office). Certified copy fee: ₹50-200 per copy.",
    tips: [
      "Ask for a receipt for every payment — even scanning/copy charges",
      "If paying via DD, make it in the name of the Sub-Registrar office",
      "Keep all payment receipts together with the registered deed",
    ],
  },
];

/**
 * Get the step-by-step registration guide for a Gujarat property transaction.
 *
 * @param type - Property type
 * @param city - City name (default: "Surat")
 * @returns RegistrationGuide with steps, witness requirements, and biometric info
 */
export function getRegistrationGuide(
  type: PropertyType,
  city: string = "Surat"
): RegistrationGuide {
  return {
    propertyType: type,
    state: "Gujarat",
    city,
    totalSteps: COMMON_REGISTRATION_STEPS.length,
    estimatedTotalTime: "1-2 weeks (from agreement finalization to registered deed collection)",
    steps: COMMON_REGISTRATION_STEPS.map((step) => ({ ...step })),
    witnessRequirements: {
      count: 2,
      idRequired: true,
      notes:
        "Two witnesses are mandatory for property registration in Gujarat. " +
        "Witnesses must be present at the Sub-Registrar office with their original Aadhaar and PAN cards. " +
        "Witnesses should not be minors. Family members can serve as witnesses. " +
        "Witnesses must provide their fingerprints and photographs.",
    },
    biometricRequirements: {
      required: true,
      who: ["Buyer", "Seller", "Witness 1", "Witness 2"],
      notes:
        "Biometric verification (fingerprint + photograph) is mandatory for all parties in Gujarat. " +
        "Biometric is matched against Aadhaar database. If Aadhaar biometric fails after 3 attempts, " +
        "alternative identity verification may be accepted at the Sub-Registrar's discretion. " +
        "If any party is represented via Power of Attorney, the PoA holder's biometric is captured " +
        "and the original registered PoA must be presented.",
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd implementation/real-estate-agent && node --import tsx --test src/tests/registration-guide.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/knowledge-base/registration-guide.ts src/tests/registration-guide.test.ts
git commit -m "feat: add Gujarat registration guide knowledge base with tests"
```

---

### Task 3: Create Post-Purchase Checklist Knowledge Base

**Files:**
- Create: `src/knowledge-base/post-purchase.ts`
- Create: `src/tests/post-purchase.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tests/post-purchase.test.ts`:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getPostPurchaseChecklist, POST_PURCHASE_TASKS } from "../knowledge-base/post-purchase.js";

describe("POST_PURCHASE_TASKS", () => {
  it("has at least 10 tasks", () => {
    assert.ok(POST_PURCHASE_TASKS.length >= 10, `expected >= 10 tasks, got ${POST_PURCHASE_TASKS.length}`);
  });

  it("all tasks have required fields", () => {
    for (const task of POST_PURCHASE_TASKS) {
      assert.ok(task.id, "id required");
      assert.ok(task.task, "task name required");
      assert.ok(task.description.length > 0, `description required for ${task.id}`);
      assert.ok(task.where.length > 0, `where required for ${task.id}`);
      assert.ok(task.when.length > 0, `when required for ${task.id}`);
      assert.ok(Array.isArray(task.documentsNeeded), `documentsNeeded must be array for ${task.id}`);
      assert.ok(task.estimatedTime.length > 0, `estimatedTime required for ${task.id}`);
      assert.equal(typeof task.mandatory, "boolean", `mandatory must be boolean for ${task.id}`);
      assert.ok(
        ["legal", "municipal", "utility", "financial", "personal"].includes(task.category),
        `invalid category for ${task.id}: ${task.category}`
      );
    }
  });

  it("all IDs are unique", () => {
    const ids = POST_PURCHASE_TASKS.map(t => t.id);
    assert.equal(ids.length, new Set(ids).size, "duplicate task IDs");
  });

  it("covers all required categories", () => {
    const categories = new Set(POST_PURCHASE_TASKS.map(t => t.category));
    assert.ok(categories.has("legal"), "should have legal tasks");
    assert.ok(categories.has("municipal"), "should have municipal tasks");
    assert.ok(categories.has("utility"), "should have utility tasks");
    assert.ok(categories.has("financial"), "should have financial tasks");
    assert.ok(categories.has("personal"), "should have personal tasks");
  });

  it("includes key Gujarat-specific tasks", () => {
    const taskNames = POST_PURCHASE_TASKS.map(t => t.task.toLowerCase());
    assert.ok(taskNames.some(t => t.includes("mutation") || t.includes("8a")), "should have property mutation task");
    assert.ok(taskNames.some(t => t.includes("tax")), "should have property tax update task");
    assert.ok(taskNames.some(t => t.includes("society") || t.includes("association")), "should have society registration task");
    assert.ok(taskNames.some(t => t.includes("electric")), "should have electricity transfer task");
  });
});

describe("getPostPurchaseChecklist", () => {
  it("returns all tasks for residential_flat", () => {
    const tasks = getPostPurchaseChecklist("residential_flat");
    assert.ok(tasks.length >= 10);
  });

  it("returns tasks for plot (no society/utility tasks)", () => {
    const tasks = getPostPurchaseChecklist("plot");
    // plots don't need society registration or utility transfers
    assert.ok(tasks.length >= 5);
    assert.ok(tasks.length < POST_PURCHASE_TASKS.length, "plot should have fewer tasks than flat");
  });

  it("mandatory tasks come first", () => {
    const tasks = getPostPurchaseChecklist("residential_flat");
    const firstNonMandatory = tasks.findIndex(t => !t.mandatory);
    if (firstNonMandatory > 0) {
      // All tasks before the first non-mandatory should be mandatory
      for (let i = 0; i < firstNonMandatory; i++) {
        assert.ok(tasks[i].mandatory, `task at index ${i} should be mandatory`);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd implementation/real-estate-agent && node --import tsx --test src/tests/post-purchase.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the post-purchase knowledge base**

Create `src/knowledge-base/post-purchase.ts`:

```typescript
// Gujarat post-purchase formalities checklist
// Source: Gujarat property transaction requirements, Surat Municipal Corporation, DGVCL, Adani Gas

import type { PostPurchaseTask, PropertyType } from "../types/index.js";

export const POST_PURCHASE_TASKS: PostPurchaseTask[] = [
  {
    id: "post_001",
    task: "Collect Registered Sale Deed",
    description:
      "Collect the original registered sale deed from the Sub-Registrar office. This is your primary proof of ownership. Verify all details — names, survey number, consideration amount, registration number.",
    where: "Sub-Registrar office",
    when: "Within 1-2 weeks of registration",
    documentsNeeded: ["Registration receipt", "ID proof (Aadhaar)"],
    estimatedTime: "30-60 minutes",
    mandatory: true,
    category: "legal",
  },
  {
    id: "post_002",
    task: "Property Mutation (8A Record Update)",
    description:
      "Apply for mutation (naam ferfar) at the Mamlatdar / Talati office to update the 7/12 and 8A revenue records with your name as the new owner. This is CRITICAL — without mutation, the government records still show the previous owner.",
    where: "Mamlatdar office / Talati office / e-Dhara center",
    when: "Within 3 months of registration",
    documentsNeeded: [
      "Registered sale deed (original + copy)",
      "7/12 extract (current)",
      "8A extract (current)",
      "Mutation application form (Form No. 6A)",
      "PAN card copy",
      "Aadhaar card copy",
      "Passport-size photos (2)",
      "Previous owner's NOC (if available)",
    ],
    estimatedTime: "1-3 months (processing time)",
    mandatory: true,
    category: "legal",
  },
  {
    id: "post_003",
    task: "Update Property Tax Records",
    description:
      "Apply at the municipal corporation to transfer the property tax record to your name. Clear any outstanding dues first. For Surat, visit the SMC (Surat Municipal Corporation) zone office.",
    where: "Municipal Corporation zone office (SMC for Surat)",
    when: "Within 1 month of registration",
    documentsNeeded: [
      "Registered sale deed (copy)",
      "Previous property tax receipt",
      "ID proof (Aadhaar + PAN)",
      "Transfer application form",
      "NOC from previous owner (if available)",
    ],
    estimatedTime: "1-2 visits, 1-2 weeks processing",
    mandatory: true,
    category: "municipal",
  },
  {
    id: "post_004",
    task: "Society / Association Registration",
    description:
      "Register as a member of the housing society or apartment association. Obtain the share certificate. Transfer the society membership from the previous owner (resale) or get new membership (new construction).",
    where: "Housing society office / Builder's office",
    when: "At possession",
    documentsNeeded: [
      "Registered sale deed (copy)",
      "Allotment letter",
      "Builder NOC / previous owner NOC",
      "Society membership application form",
      "Passport-size photos (2)",
      "Share transfer form (for resale)",
    ],
    estimatedTime: "1-2 weeks",
    mandatory: true,
    category: "legal",
  },
  {
    id: "post_005",
    task: "Electricity Connection Transfer",
    description:
      "Transfer the electricity connection to your name at DGVCL (Dakshin Gujarat Vij Company Ltd) for Surat. If new construction, apply for a new connection. Carry the old meter number and consumer number.",
    where: "DGVCL office (Surat) or online at dgvcl.com",
    when: "At possession",
    documentsNeeded: [
      "Registered sale deed (copy)",
      "Society NOC / builder NOC",
      "Previous electricity bill (for transfer)",
      "ID proof (Aadhaar + PAN)",
      "Application form",
      "Security deposit (₹1,000-5,000 depending on load)",
    ],
    estimatedTime: "1-2 weeks",
    mandatory: true,
    category: "utility",
  },
  {
    id: "post_006",
    task: "Water Connection Transfer",
    description:
      "Transfer the water connection at the municipal corporation (SMC for Surat). For new buildings, the society usually handles the bulk connection, but individual meter transfer is still needed.",
    where: "Municipal Corporation water department (SMC for Surat)",
    when: "At possession",
    documentsNeeded: [
      "Registered sale deed (copy)",
      "Society NOC",
      "Previous water bill (if transfer)",
      "Application form",
      "ID proof",
    ],
    estimatedTime: "1-2 weeks",
    mandatory: true,
    category: "utility",
  },
  {
    id: "post_007",
    task: "Gas Connection Transfer",
    description:
      "Transfer or apply for a new piped gas connection. For Surat, the provider is Adani Gas (now ATGL — Adani Total Gas Ltd). If the society has piped gas infrastructure, apply for an individual connection.",
    where: "Adani Gas / ATGL office or online at adanigas.com",
    when: "At possession",
    documentsNeeded: [
      "Registered sale deed (copy)",
      "Society NOC",
      "ID proof (Aadhaar)",
      "Application form",
      "Security deposit (₹3,000-6,000)",
    ],
    estimatedTime: "1-3 weeks",
    mandatory: false,
    category: "utility",
  },
  {
    id: "post_008",
    task: "Home Loan EMI Start Verification",
    description:
      "Verify that the home loan EMI has started correctly after disbursement. Check the amortization schedule, EMI amount, interest rate, and ensure the loan account reflects the correct property details.",
    where: "Bank (home loan branch)",
    when: "After loan disbursement",
    documentsNeeded: [
      "Loan account details",
      "Amortization schedule",
      "Disbursement letter",
      "Registered sale deed (bank's copy)",
    ],
    estimatedTime: "1-2 hours at bank",
    mandatory: true,
    category: "financial",
  },
  {
    id: "post_009",
    task: "Home Insurance",
    description:
      "Get home insurance covering the structure (not land value) against fire, natural disasters, and other perils. Many banks require this as a condition of the home loan. Compare premiums across insurers.",
    where: "Insurance company / online",
    when: "Within 1 month of possession",
    documentsNeeded: [
      "Registered sale deed (copy)",
      "Property valuation report",
      "Home loan details (if linking to loan)",
      "ID proof",
    ],
    estimatedTime: "1-2 days",
    mandatory: false,
    category: "financial",
  },
  {
    id: "post_010",
    task: "Update Address on Aadhaar and PAN",
    description:
      "Update your residential address on Aadhaar (UIDAI) and PAN card (Income Tax) to the new property address. You'll need an address proof from the new property — the electricity bill or a society letter works.",
    where: "UIDAI (online or Aadhaar center) + Income Tax portal",
    when: "Within 3 months of possession",
    documentsNeeded: [
      "New address proof (electricity bill / society letter / registered deed)",
      "Current Aadhaar card",
      "PAN card",
    ],
    estimatedTime: "1-2 hours (online)",
    mandatory: false,
    category: "personal",
  },
  {
    id: "post_011",
    task: "Property in Income Tax Declaration",
    description:
      "Declare the property in your next Income Tax Return (ITR). If you have a home loan, claim deductions under Section 24(b) for interest (up to ₹2 lakh) and Section 80C for principal (up to ₹1.5 lakh). If this is your second property, rental income must be declared.",
    where: "Income Tax portal (incometax.gov.in)",
    when: "Next tax filing season (July)",
    documentsNeeded: [
      "Registered sale deed",
      "Home loan interest certificate (from bank)",
      "Home loan principal repayment certificate",
      "Property tax receipt",
    ],
    estimatedTime: "Part of regular ITR filing",
    mandatory: true,
    category: "financial",
  },
  {
    id: "post_012",
    task: "Store Originals in Bank Locker",
    description:
      "Store all original documents in a bank safe deposit locker: registered sale deed, original agreement, all NOCs, e-stamp certificate, title deed chain, 7/12 and 8A extracts. Keep certified copies at home for day-to-day use.",
    where: "Bank (safe deposit locker)",
    when: "Immediately after collecting all documents",
    documentsNeeded: [
      "All original property documents",
      "Bank locker key / access",
    ],
    estimatedTime: "30 minutes",
    mandatory: true,
    category: "personal",
  },
];

// Tasks applicable to plots (no society, no utility transfers)
const PLOT_EXCLUDED_TASKS = new Set([
  "post_004", // society registration
  "post_005", // electricity transfer
  "post_006", // water transfer
  "post_007", // gas transfer
]);

/**
 * Get the post-purchase checklist for a given property type.
 * Mandatory tasks are sorted first.
 *
 * @param type - Property type
 * @returns Sorted array of PostPurchaseTask items
 */
export function getPostPurchaseChecklist(type: PropertyType): PostPurchaseTask[] {
  let tasks = POST_PURCHASE_TASKS;

  if (type === "plot") {
    tasks = tasks.filter((t) => !PLOT_EXCLUDED_TASKS.has(t.id));
  }

  // Sort: mandatory first, then by original order
  return [...tasks].sort((a, b) => {
    if (a.mandatory && !b.mandatory) return -1;
    if (!a.mandatory && b.mandatory) return 1;
    return 0;
  });
}
```

- [ ] **Step 4: Run tests**

Run: `cd implementation/real-estate-agent && node --import tsx --test src/tests/post-purchase.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/knowledge-base/post-purchase.ts src/tests/post-purchase.test.ts
git commit -m "feat: add Gujarat post-purchase checklist knowledge base with tests"
```

---

### Task 3.5: Create Negative Constraints (What the Agent Cannot Verify)

**Files:**
- Create: `src/knowledge-base/negative-constraints.ts`
- Create: `src/tests/negative-constraints.test.ts`

This is a critical safety feature. Users may over-rely on a "Clear" or "Low Risk" status without understanding the agent's blind spots. The agent must explicitly state what it CANNOT find or verify so buyers know where they still need professional help.

- [ ] **Step 1: Write the failing test**

Create `src/tests/negative-constraints.test.ts`:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NEGATIVE_CONSTRAINTS, getConstraintsForPhase, formatConstraintsDisclaimer } from "../knowledge-base/negative-constraints.js";

describe("NEGATIVE_CONSTRAINTS", () => {
  it("has at least 10 constraints", () => {
    assert.ok(NEGATIVE_CONSTRAINTS.length >= 10, `expected >= 10, got ${NEGATIVE_CONSTRAINTS.length}`);
  });

  it("all constraints have required fields", () => {
    for (const c of NEGATIVE_CONSTRAINTS) {
      assert.ok(c.id, "id required");
      assert.ok(c.limitation, "limitation required");
      assert.ok(c.reason.length > 0, `reason required for ${c.id}`);
      assert.ok(c.whatBuyerShouldDo.length > 0, `whatBuyerShouldDo required for ${c.id}`);
      assert.ok(c.phase.length > 0, `phase required for ${c.id}`);
      assert.ok(["critical", "important", "informational"].includes(c.severity), `invalid severity for ${c.id}`);
    }
  });

  it("all IDs are unique", () => {
    const ids = NEGATIVE_CONSTRAINTS.map(c => c.id);
    assert.equal(ids.length, new Set(ids).size, "duplicate IDs");
  });

  it("covers key blind spots", () => {
    const limitations = NEGATIVE_CONSTRAINTS.map(c => c.limitation.toLowerCase());
    assert.ok(limitations.some(l => l.includes("oral") || l.includes("unregistered")), "should mention oral/unregistered agreements");
    assert.ok(limitations.some(l => l.includes("physical") || l.includes("site")), "should mention physical inspection");
    assert.ok(limitations.some(l => l.includes("encumbrance") || l.includes("bank")), "should mention hidden encumbrances");
  });
});

describe("getConstraintsForPhase", () => {
  it("returns constraints for due_diligence phase", () => {
    const constraints = getConstraintsForPhase("due_diligence");
    assert.ok(constraints.length > 0);
  });

  it("returns constraints for registration phase", () => {
    const constraints = getConstraintsForPhase("registration");
    assert.ok(constraints.length > 0);
  });

  it("returns all constraints when no phase specified", () => {
    const all = getConstraintsForPhase();
    assert.equal(all.length, NEGATIVE_CONSTRAINTS.length);
  });
});

describe("formatConstraintsDisclaimer", () => {
  it("returns non-empty string", () => {
    const disclaimer = formatConstraintsDisclaimer("due_diligence");
    assert.ok(disclaimer.length > 0);
    assert.ok(disclaimer.includes("CANNOT"));
  });

  it("includes buyer action items", () => {
    const disclaimer = formatConstraintsDisclaimer("due_diligence");
    assert.ok(disclaimer.includes("should") || disclaimer.includes("recommend") || disclaimer.includes("must"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd implementation/real-estate-agent && node --import tsx --test src/tests/negative-constraints.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the negative constraints knowledge base**

Create `src/knowledge-base/negative-constraints.ts`:

```typescript
// Negative Constraints — what the agent CANNOT verify or find
// This is a SAFETY feature. Without these disclaimers, buyers may
// over-rely on the agent's "Clear" or "Low Risk" status.

import type { PurchasePhase } from "../types/index.js";

export interface NegativeConstraint {
  id: string;
  limitation: string;
  reason: string;
  whatBuyerShouldDo: string;
  phase: PurchasePhase;
  severity: "critical" | "important" | "informational";
}

export const NEGATIVE_CONSTRAINTS: NegativeConstraint[] = [
  // --- Due Diligence blind spots ---
  {
    id: "nc_001",
    limitation: "Cannot verify oral agreements or unregistered Satakhats (informal sale agreements)",
    reason:
      "In Gujarat, informal sale agreements (Satakhats) between parties are common, especially in rural or semi-urban areas. These are not registered with any government portal and leave no digital trail. The agent only accesses registered documents via GARVI.",
    whatBuyerShouldDo:
      "Ask the seller directly if any prior oral agreement, Satakhat, or informal commitment exists with another party. Have your lawyer include a warranty clause in the agreement stating the seller has no prior commitments.",
    phase: "due_diligence",
    severity: "critical",
  },
  {
    id: "nc_002",
    limitation: "Cannot perform physical site inspection or verify actual construction quality",
    reason:
      "The agent operates entirely through digital portals and data analysis. It cannot visit the property, inspect construction quality, check for structural defects, verify amenities, or confirm that the physical property matches the approved plan.",
    whatBuyerShouldDo:
      "Always conduct a personal site visit (preferably with a civil engineer). Check construction quality, water seepage, structural integrity, ventilation, and compare the actual layout with the approved building plan.",
    phase: "due_diligence",
    severity: "critical",
  },
  {
    id: "nc_003",
    limitation: "Cannot detect hidden encumbrances or bank liens not yet reflected in records",
    reason:
      "There is a lag between when a bank creates a lien/mortgage and when it appears in Sub-Registrar or revenue records. A property could have a fresh loan against it that hasn't been registered yet. AnyRoR and EC records may be weeks to months behind.",
    whatBuyerShouldDo:
      "Obtain a fresh Encumbrance Certificate (EC) directly from the Sub-Registrar office (not online) for the last 30 years. Ask the seller for a bank NOC and verify directly with their bank.",
    phase: "due_diligence",
    severity: "critical",
  },
  {
    id: "nc_004",
    limitation: "Cannot verify the identity of the actual seller or detect impersonation",
    reason:
      "The agent verifies names against government records but cannot confirm that the person you are dealing with is actually the person named in the records. Identity fraud (someone posing as the property owner) is a known risk.",
    whatBuyerShouldDo:
      "Verify the seller's identity in person with original ID documents (Aadhaar, PAN, passport). Biometric verification at the Sub-Registrar office provides an additional layer, but meeting the seller in person before the agreement is essential.",
    phase: "due_diligence",
    severity: "critical",
  },
  {
    id: "nc_005",
    limitation: "Cannot access records older than what government portals show (typically 10-15 years)",
    reason:
      "AnyRoR, eCourts, and GARVI have limited historical data. Older land records, disputes, and transactions may only exist in physical registers at the Talati or Sub-Registrar office. A property with a 30-year dispute history may show only the last 10 years online.",
    whatBuyerShouldDo:
      "Engage a property lawyer to conduct a manual title search at the Sub-Registrar office going back at least 30 years. This is the single most important step that the agent cannot replace.",
    phase: "due_diligence",
    severity: "critical",
  },
  {
    id: "nc_006",
    limitation: "Cannot detect benami (proxy ownership) transactions",
    reason:
      "Benami transactions — where property is held in a name other than the true owner — are illegal under the Benami Transactions Act but still occur. The agent sees only the name on record, not whether that person is the true beneficial owner.",
    whatBuyerShouldDo:
      "If the property has changed hands unusually frequently or involves complex ownership structures, have your lawyer investigate the chain of ownership for benami indicators.",
    phase: "due_diligence",
    severity: "important",
  },
  {
    id: "nc_007",
    limitation: "Cannot verify accuracy of eCourts data or detect unreported disputes",
    reason:
      "eCourts data may have a lag of weeks to months. Not all courts have digitized older records. Cases filed in tribunals, consumer forums, or arbitration may not appear. Cases under appeal may not show updated status.",
    whatBuyerShouldDo:
      "Treat eCourts results as indicative, not exhaustive. Engage a lawyer to do a physical search at the relevant district court, High Court, consumer forum, and any tribunals.",
    phase: "due_diligence",
    severity: "important",
  },
  {
    id: "nc_008",
    limitation: "Cannot verify actual possession status of the property",
    reason:
      "Government records show legal ownership, not who is physically in possession. A property could be legally owned by one person but occupied by tenants, squatters, or a previous owner who refuses to vacate.",
    whatBuyerShouldDo:
      "Visit the property to confirm it is vacant or that the current occupant acknowledges the sale. For resale, get a written confirmation from the current occupant. For new construction, verify with the society.",
    phase: "due_diligence",
    severity: "important",
  },
  {
    id: "nc_009",
    limitation: "Cannot verify environmental or zoning compliance beyond what portals show",
    reason:
      "The agent cannot check if the property is in a flood zone, coastal regulation zone (CRZ), near high-tension power lines, or affected by upcoming government acquisition (TP scheme road widening, metro alignment, etc.).",
    whatBuyerShouldDo:
      "Check the Town Planning (TP) scheme for the area. Visit the local development authority (SUDA for Surat) to confirm the property is not affected by any reservation, road widening, or government acquisition.",
    phase: "due_diligence",
    severity: "important",
  },
  {
    id: "nc_010",
    limitation: "Cannot read or analyze Gujarati-language documents in scanned/image format",
    reason:
      "Many Gujarat government records, older title deeds, and revenue documents are in Gujarati. Scanned documents or images cannot be reliably extracted. The agent works best with structured digital data from portals.",
    whatBuyerShouldDo:
      "Have a bilingual property lawyer review all Gujarati-language documents. Do not rely on machine translations for legal documents — nuances in Gujarati legal terms can change the meaning significantly.",
    phase: "document_review",
    severity: "important",
  },
  {
    id: "nc_011",
    limitation: "Cannot guarantee portal data is current or accurate",
    reason:
      "Government portal data can be outdated, incomplete, or contain data entry errors. RERA quarterly updates may be delayed. AnyRoR mutations can take months to reflect. SMC tax records may not show recent payments.",
    whatBuyerShouldDo:
      "Use the agent's findings as a starting point, not the final word. For any critical finding (ownership, litigation, encumbrance), verify with a physical visit to the relevant office.",
    phase: "due_diligence",
    severity: "important",
  },
  {
    id: "nc_012",
    limitation: "Cannot verify builder's financial health or project viability beyond GSTN/RERA data",
    reason:
      "The agent checks GSTN registration and RERA compliance but cannot access the builder's balance sheet, bank statements, project-specific RERA escrow account balance, or order book. A builder could be RERA-compliant but financially distressed.",
    whatBuyerShouldDo:
      "Research the builder independently — check MCA (Ministry of Corporate Affairs) for company financials, talk to existing buyers in the builder's other projects, check if the builder has delayed possession elsewhere.",
    phase: "due_diligence",
    severity: "informational",
  },
  {
    id: "nc_013",
    limitation: "Cannot verify authenticity of documents provided by the seller/builder",
    reason:
      "The agent cross-references portal data with what you provide, but cannot verify that a physical document (title deed, NOC, EC) shown to you is genuine and not forged. Document forgery is a known risk in Indian real estate.",
    whatBuyerShouldDo:
      "Verify all critical documents at the issuing office. For Encumbrance Certificates, verify at the Sub-Registrar office. For 7/12 extracts, verify at the Talati office. For RERA certificates, verify on the GujRERA portal (the agent does this).",
    phase: "document_review",
    severity: "important",
  },
  {
    id: "nc_014",
    limitation: "Cannot track registration process or Sub-Registrar office delays",
    reason:
      "The registration process is manual and happens at the Sub-Registrar office. The agent provides a step-by-step guide but cannot track your appointment status, document processing, or alert you to delays.",
    whatBuyerShouldDo:
      "Follow up with the Sub-Registrar office directly if there are delays. Carry your advocate's contact number on registration day. Most delays are due to missing documents — the agent's checklist helps prevent this.",
    phase: "registration",
    severity: "informational",
  },
];

/**
 * Get negative constraints filtered by purchase phase.
 * If no phase specified, returns all constraints.
 */
export function getConstraintsForPhase(phase?: PurchasePhase): NegativeConstraint[] {
  if (!phase) return NEGATIVE_CONSTRAINTS;
  return NEGATIVE_CONSTRAINTS.filter((c) => c.phase === phase);
}

/**
 * Format a disclaimer section listing what the agent cannot verify.
 * This should be included in every due diligence report and dossier.
 */
export function formatConstraintsDisclaimer(phase?: PurchasePhase): string {
  const constraints = getConstraintsForPhase(phase);
  const critical = constraints.filter((c) => c.severity === "critical");
  const important = constraints.filter((c) => c.severity === "important");
  const informational = constraints.filter((c) => c.severity === "informational");

  let output = `\n## What This Agent CANNOT Verify\n\n`;
  output += `This agent verifies property data across government portals, but has blind spots. `;
  output += `A "Clear" or "Low Risk" status means no issues were found in the data available — `;
  output += `it does NOT mean the property is free from all risks.\n\n`;

  if (critical.length > 0) {
    output += `### Critical Blind Spots (must be independently verified)\n\n`;
    for (const c of critical) {
      output += `- **${c.limitation}**\n  ${c.reason}\n  *What you should do:* ${c.whatBuyerShouldDo}\n\n`;
    }
  }

  if (important.length > 0) {
    output += `### Important Limitations\n\n`;
    for (const c of important) {
      output += `- **${c.limitation}**\n  *What you should do:* ${c.whatBuyerShouldDo}\n\n`;
    }
  }

  if (informational.length > 0) {
    output += `### Additional Notes\n\n`;
    for (const c of informational) {
      output += `- ${c.limitation} — ${c.whatBuyerShouldDo}\n\n`;
    }
  }

  output += `---\n*Always engage a property lawyer and conduct a physical site visit before finalizing any property purchase.*\n`;

  return output;
}
```

- [ ] **Step 4: Run tests**

Run: `cd implementation/real-estate-agent && node --import tsx --test src/tests/negative-constraints.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/knowledge-base/negative-constraints.ts src/tests/negative-constraints.test.ts
git commit -m "feat: add negative constraints — what the agent CANNOT verify"
```

---

### Task 4: Add MCP Tools for Registration Guide, Post-Purchase, and Negative Constraints

**Files:**
- Modify: `src/mcp-servers/property-kb-mcp.ts`

- [ ] **Step 1: Add imports at the top of property-kb-mcp.ts**

After the existing import for `calculateTotalCost`:

```typescript
import { getRegistrationGuide } from "../knowledge-base/registration-guide.js";
import { getPostPurchaseChecklist } from "../knowledge-base/post-purchase.js";
import { getConstraintsForPhase, formatConstraintsDisclaimer } from "../knowledge-base/negative-constraints.js";
import type { PurchasePhase } from "../types/index.js";
```

- [ ] **Step 2: Add the get_registration_guide tool**

Add before the `export const propertyKbMcp = createSdkMcpServer(...)` line:

```typescript
const getRegistrationGuideTool = tool(
  "get_registration_guide",
  "Get step-by-step Gujarat property registration guide including e-stamping, Sub-Registrar appointment, biometric verification, document preparation, witness requirements, and post-registration collection. Tailored to property type.",
  {
    property_type: z
      .enum(["residential_flat", "commercial_office", "plot", "row_house", "villa"])
      .describe("Property type"),
    city: z
      .string()
      .optional()
      .describe("City name (default: Surat)"),
  },
  async ({ property_type, city }) => {
    const guide = getRegistrationGuide(property_type as PropertyType, city ?? "Surat");

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            property_type,
            city: guide.city,
            state: guide.state,
            total_steps: guide.totalSteps,
            estimated_total_time: guide.estimatedTotalTime,
            steps: guide.steps.map((s) => ({
              step: s.step,
              title: s.title,
              description: s.description,
              location: s.location,
              documents_needed: s.documentsNeeded,
              estimated_time: s.estimatedTime,
              fees: s.fees ?? null,
              tips: s.tips,
            })),
            witness_requirements: {
              count: guide.witnessRequirements.count,
              id_required: guide.witnessRequirements.idRequired,
              notes: guide.witnessRequirements.notes,
            },
            biometric_requirements: {
              required: guide.biometricRequirements.required,
              who: guide.biometricRequirements.who,
              notes: guide.biometricRequirements.notes,
            },
            note: "This guide is specific to Gujarat property registration. The process may vary slightly by Sub-Registrar office. Always confirm requirements with your advocate.",
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);
```

- [ ] **Step 3: Add the get_post_purchase_checklist tool**

Add after the registration guide tool:

```typescript
const getPostPurchaseChecklistTool = tool(
  "get_post_purchase_checklist",
  "Get the complete post-purchase formalities checklist for Gujarat. Includes property mutation (8A update), tax transfer, society registration, utility connections, home loan verification, insurance, and document storage. Tasks are ordered by priority (mandatory first).",
  {
    property_type: z
      .enum(["residential_flat", "commercial_office", "plot", "row_house", "villa"])
      .describe("Property type"),
  },
  async ({ property_type }) => {
    const tasks = getPostPurchaseChecklist(property_type as PropertyType);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            property_type,
            total_tasks: tasks.length,
            mandatory_count: tasks.filter((t) => t.mandatory).length,
            tasks: tasks.map((t, i) => ({
              serial: i + 1,
              id: t.id,
              task: t.task,
              description: t.description,
              where: t.where,
              when: t.when,
              documents_needed: t.documentsNeeded,
              estimated_time: t.estimatedTime,
              mandatory: t.mandatory,
              category: t.category,
            })),
            note: "Complete mandatory tasks first. Timelines are from the date of property registration. For Surat-specific offices, use the addresses and contacts provided.",
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);
```

- [ ] **Step 4: Add the get_verification_limitations tool**

Add after the post-purchase checklist tool:

```typescript
const getVerificationLimitationsTool = tool(
  "get_verification_limitations",
  "Get a list of what this agent CANNOT verify or find. This is a safety disclaimer that should be included in every due diligence report and dossier. A 'Clear' status means no issues were found in available data — it does NOT mean the property is risk-free. Filtered by purchase phase.",
  {
    phase: z
      .enum(["due_diligence", "document_review", "financial_analysis", "registration", "post_purchase"])
      .optional()
      .describe("Filter by purchase phase (omit for all constraints)"),
  },
  async ({ phase }) => {
    const constraints = getConstraintsForPhase(phase as PurchasePhase | undefined);
    const disclaimer = formatConstraintsDisclaimer(phase as PurchasePhase | undefined);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            phase: phase ?? "all",
            total_limitations: constraints.length,
            critical_count: constraints.filter((c) => c.severity === "critical").length,
            limitations: constraints.map((c) => ({
              id: c.id,
              limitation: c.limitation,
              severity: c.severity,
              reason: c.reason,
              buyer_action: c.whatBuyerShouldDo,
            })),
            formatted_disclaimer: disclaimer,
            note: "ALWAYS include this disclaimer in reports. A 'Clear' result without this disclaimer may give buyers false confidence.",
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);
```

- [ ] **Step 5: Add all three tools to the MCP server export**

Update the `createSdkMcpServer` call to include the new tools:

```typescript
export const propertyKbMcp = createSdkMcpServer({
  name: "property-kb-mcp",
  tools: [
    getJantriRateTool,
    calculateStampDutyTool,
    checkRedFlagsTool,
    getRequiredDocumentsTool,
    calculateTotalCostTool,
    getRegistrationGuideTool,
    getPostPurchaseChecklistTool,
    getVerificationLimitationsTool,
  ],
});
```

- [ ] **Step 6: Verify typecheck passes**

Run: `cd implementation/real-estate-agent && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/mcp-servers/property-kb-mcp.ts
git commit -m "feat: add registration guide and post-purchase checklist MCP tools"
```

---

### Task 5: Add Checklist Tracking Tool to Tracker MCP

**Files:**
- Modify: `src/mcp-servers/tracker-mcp.ts`

- [ ] **Step 1: Add checklist state to tracker**

After the existing `const purchases = new Map<string, Purchase>();` line, add:

```typescript
import type { Purchase, VerificationEntry, PurchasePhase, ChecklistItem, ChecklistItemStatus } from "../types/index.js";

// Checklist items per purchase
const checklists = new Map<string, ChecklistItem[]>();
```

Also update the existing import to include the new types (replace the old import line).

- [ ] **Step 2: Add the track_checklist_item tool**

Add before the `export const trackerMcp = createSdkMcpServer(...)` line:

```typescript
const trackChecklistItemTool = tool(
  "track_checklist_item",
  "Update the status of a post-purchase checklist item. Use this to track which formalities the buyer has completed (mutation, tax transfer, society registration, etc.).",
  {
    purchase_id: z.string().describe("Purchase ID"),
    task_id: z.string().describe("Task ID from get_post_purchase_checklist (e.g. 'post_001')"),
    status: z
      .enum(["pending", "in_progress", "completed", "skipped", "blocked"])
      .describe("New status"),
    notes: z.string().optional().describe("Optional notes (e.g. 'Application submitted on 2026-04-01')"),
  },
  async ({ purchase_id, task_id, status, notes }) => {
    const purchase = purchases.get(purchase_id);
    if (!purchase) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: `Purchase '${purchase_id}' not found. Available: ${[...purchases.keys()].join(", ") || "none"}`,
            }),
          },
        ],
      };
    }

    if (!checklists.has(purchase_id)) {
      checklists.set(purchase_id, []);
    }

    const items = checklists.get(purchase_id)!;
    const existing = items.find((i) => i.taskId === task_id);

    if (existing) {
      existing.status = status as ChecklistItemStatus;
      existing.notes = notes ?? existing.notes;
      if (status === "completed") {
        existing.completedAt = new Date().toISOString();
      }
    } else {
      items.push({
        taskId: task_id,
        purchaseId: purchase_id,
        status: status as ChecklistItemStatus,
        completedAt: status === "completed" ? new Date().toISOString() : undefined,
        notes,
      });
    }

    const completedCount = items.filter((i) => i.status === "completed").length;
    const totalTracked = items.length;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            purchase_id,
            task_id,
            status,
            notes: notes ?? null,
            progress: `${completedCount}/${totalTracked} tasks completed`,
            all_items: items.map((i) => ({
              task_id: i.taskId,
              status: i.status,
              completed_at: i.completedAt ?? null,
              notes: i.notes ?? null,
            })),
          }),
        },
      ],
    };
  }
);
```

- [ ] **Step 3: Add the tool to the tracker MCP server export**

Update the `createSdkMcpServer` call:

```typescript
export const trackerMcp = createSdkMcpServer({
  name: "tracker-mcp",
  tools: [
    createPurchaseTool,
    logVerificationTool,
    getVerificationLogTool,
    updatePhaseTool,
    getPurchaseSummaryTool,
    trackChecklistItemTool,
  ],
});
```

- [ ] **Step 4: Verify typecheck passes**

Run: `cd implementation/real-estate-agent && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/mcp-servers/tracker-mcp.ts
git commit -m "feat: add checklist tracking tool to tracker MCP"
```

---

### Task 6: Extend Copilot System Prompt with Phase 4-5

**Files:**
- Modify: `src/copilot.ts`

- [ ] **Step 1: Update the copilot system prompt**

In `src/copilot.ts`, find the section after `PHASE 5 — BUYER SUPPORT:` and before `CRITICAL RULES:`. Replace `PHASE 5 — BUYER SUPPORT:` and everything up to (but not including) `CRITICAL RULES:` with:

```typescript
PHASE 5 — REGISTRATION GUIDE (when buyer is ready to register):
When the buyer has completed due diligence and financial analysis and says they want to proceed with registration:
1. Use update_phase to move to "registration" phase
2. Use get_registration_guide to get the step-by-step registration process
3. Walk the buyer through each step conversationally:
   - "Step 1: Let's finalize the agreement. Have you had YOUR lawyer review it?"
   - "Step 2: You need e-stamps worth Rs X. Here's how to get them..."
   - "Step 3: These are the documents you'll need on registration day..."
4. Explain witness and biometric requirements clearly
5. Offer to generate a "Registration Day Checklist" — a concise printable list

PHASE 6 — POST-PURCHASE TRACKING (after registration):
After the property is registered:
1. Use update_phase to move to "post_purchase" phase
2. Use get_post_purchase_checklist to get all post-purchase tasks
3. Present the checklist with priorities:
   - "Mandatory and urgent: Collect registered deed, apply for mutation, update tax records"
   - "At possession: Society registration, electricity/water/gas transfer"
   - "Can wait: Address update, ITR declaration, home insurance"
4. Track progress using track_checklist_item as the buyer completes each task
5. Proactively remind about deadlines:
   - "Mutation should be done within 3 months — have you started the application?"
   - "Tax transfer at SMC takes 1-2 weeks — don't wait until the next bill arrives"

PHASE 7 — BUYER SUPPORT (ongoing):
The buyer may ask:
- "What documents should I collect?"
- "Is the stamp duty different if my wife's name is first?"
- "How much will I save if I declare the full amount?"
- "What's the actual cost of the cash component long-term?"
- "Is the price fair for this area compared to jantri?"
- "What should I check during the site visit?"
- "How does this builder's track record look?"
- "What do I need for registration day?"
- "I've registered — what's next?"
- "How do I apply for mutation?"

Answer conversationally, backed by tool results. For cost questions, ALWAYS use
calculate_total_cost to give exact numbers, not estimates.
```

- [ ] **Step 2: Add new tool display names**

In the `TOOL_DISPLAY` object in `src/copilot.ts`, add:

```typescript
"mcp__property-kb-mcp__get_registration_guide": "Loading registration guide",
"mcp__property-kb-mcp__get_post_purchase_checklist": "Loading post-purchase checklist",
"mcp__property-kb-mcp__calculate_total_cost": "Calculating total cost",
"mcp__tracker-mcp__track_checklist_item": "Tracking checklist progress",
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd implementation/real-estate-agent && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/copilot.ts
git commit -m "feat: extend copilot with Phase 4-5 registration guide and post-purchase tracking"
```

---

### Task 7: Run All Tests and Final Verification

**Files:** None — verification only

- [ ] **Step 1: Run all tests**

Run: `cd implementation/real-estate-agent && npm test`
Expected: All tests pass (82 existing + ~30 new = ~112 total)

- [ ] **Step 2: Run typecheck**

Run: `cd implementation/real-estate-agent && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Final commit and push**

```bash
git add -A
git status  # verify no unwanted files
git push
```

---

## Summary of Changes

| Component | Change | Tools Added |
|-----------|--------|-------------|
| `types/index.ts` | New types: `RegistrationStep`, `RegistrationGuide`, `PostPurchaseTask`, `ChecklistItem`, `ChecklistItemStatus` | — |
| `knowledge-base/registration-guide.ts` | NEW: 10-step Gujarat registration process (agreement → e-stamping → documents → Sub-Registrar → biometric → signing → collection) | — |
| `knowledge-base/post-purchase.ts` | NEW: 12 post-purchase tasks covering mutation, tax, society, utilities, insurance, ITR, document storage | — |
| `mcp-servers/property-kb-mcp.ts` | 2 new tools | `get_registration_guide`, `get_post_purchase_checklist` |
| `mcp-servers/tracker-mcp.ts` | 1 new tool | `track_checklist_item` |
| `copilot.ts` | Extended system prompt with Phase 5 (registration) and Phase 6 (post-purchase) workflow | — |
| Tests | 2 new test files (~30 tests) | — |

**Total new MCP tools:** 3 (bringing total from 19 to 22)
**Total new knowledge base modules:** 2
**Total new test cases:** ~30
