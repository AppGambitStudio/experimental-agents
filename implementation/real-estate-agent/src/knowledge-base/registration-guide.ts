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
