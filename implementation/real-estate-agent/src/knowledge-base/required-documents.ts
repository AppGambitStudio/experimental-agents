// Required document checklists per property type for Gujarat real estate transactions

import { PropertyType } from "../types/index.js";

export interface DocumentRequirement {
  name: string;
  description: string;
  mandatory: boolean;
  source: string;
}

const COMMON_DOCUMENTS: DocumentRequirement[] = [
  {
    name: "Title Deed (Sale Deed)",
    description:
      "Registered sale deed establishing current ownership. Verify chain of title for at least 30 years.",
    mandatory: true,
    source: "Sub-Registrar Office",
  },
  {
    name: "7/12 Extract (Satbara Utara)",
    description:
      "Revenue record showing land ownership, survey number, area, and crop/land use details.",
    mandatory: true,
    source: "Talati / e-Dhara / AnyRoR Gujarat portal",
  },
  {
    name: "8A Extract (Khatavahi)",
    description:
      "Rights record showing owner details linked to the 7/12. Confirms name and share of each owner.",
    mandatory: true,
    source: "Talati / e-Dhara / AnyRoR Gujarat portal",
  },
  {
    name: "Encumbrance Certificate (EC)",
    description:
      "Certificate from Sub-Registrar confirming no mortgages, liens, or encumbrances on the property for the past 13+ years.",
    mandatory: true,
    source: "Sub-Registrar Office",
  },
  {
    name: "Property Tax Receipt",
    description:
      "Latest property tax paid receipt from the municipal corporation (e.g., SMC for Surat). Confirms no outstanding dues.",
    mandatory: true,
    source: "Municipal Corporation (SMC / AMC etc.)",
  },
];

const RESIDENTIAL_FLAT_DOCUMENTS: DocumentRequirement[] = [
  ...COMMON_DOCUMENTS,
  {
    name: "RERA Registration Certificate",
    description:
      "GujRERA registration certificate with project ID, builder details, and validity dates.",
    mandatory: true,
    source: "GujRERA Portal (gujrera.gujarat.gov.in)",
  },
  {
    name: "Occupancy Certificate (OC)",
    description:
      "Certificate from local authority confirming the building is fit for occupation. Required for completed projects.",
    mandatory: true,
    source: "Municipal Corporation / Development Authority",
  },
  {
    name: "Completion Certificate (CC)",
    description:
      "Certificate confirming construction is completed as per the approved plan.",
    mandatory: true,
    source: "Municipal Corporation / Development Authority",
  },
  {
    name: "Society NOC",
    description:
      "No Objection Certificate from the housing society for resale transactions. Confirms no dues and society consent.",
    mandatory: true,
    source: "Housing Society Committee",
  },
  {
    name: "Approved Building Plan",
    description:
      "Building plan approved by the local development authority (SUDA/SMC). Verify floor plan matches actual construction.",
    mandatory: true,
    source: "Municipal Corporation / Development Authority",
  },
  {
    name: "Builder-Buyer Agreement",
    description:
      "Registered agreement between builder and buyer as per RERA format. Must include carpet area, price, possession date, and penalties.",
    mandatory: true,
    source: "Builder / Developer",
  },
  {
    name: "Allotment Letter",
    description:
      "Letter from builder allotting the specific unit with flat number, floor, carpet area, and payment schedule.",
    mandatory: true,
    source: "Builder / Developer",
  },
];

const ROW_HOUSE_VILLA_DOCUMENTS: DocumentRequirement[] = [
  ...COMMON_DOCUMENTS,
  {
    name: "RERA Registration Certificate",
    description:
      "GujRERA registration certificate for the project/layout.",
    mandatory: true,
    source: "GujRERA Portal (gujrera.gujarat.gov.in)",
  },
  {
    name: "Occupancy Certificate (OC)",
    description:
      "Certificate confirming the unit is fit for occupation.",
    mandatory: true,
    source: "Municipal Corporation / Development Authority",
  },
  {
    name: "Completion Certificate (CC)",
    description:
      "Certificate confirming construction is completed as per approved plan.",
    mandatory: true,
    source: "Municipal Corporation / Development Authority",
  },
  {
    name: "Approved Building Plan",
    description:
      "Approved layout and building plan from the development authority.",
    mandatory: true,
    source: "Municipal Corporation / Development Authority",
  },
  {
    name: "Builder-Buyer Agreement",
    description:
      "Registered agreement with builder including plot area, built-up area, and common area details.",
    mandatory: true,
    source: "Builder / Developer",
  },
  {
    name: "Allotment Letter",
    description:
      "Allotment letter specifying unit/plot number, area, and payment terms.",
    mandatory: true,
    source: "Builder / Developer",
  },
  {
    name: "NA Order (if applicable)",
    description:
      "Non-Agricultural conversion order if the land was originally agricultural.",
    mandatory: false,
    source: "Collector / Mamlatdar Office",
  },
];

const COMMERCIAL_OFFICE_DOCUMENTS: DocumentRequirement[] = [
  ...COMMON_DOCUMENTS,
  {
    name: "RERA Registration Certificate",
    description:
      "GujRERA registration certificate (required for commercial projects with > 500 sqm or > 8 units).",
    mandatory: true,
    source: "GujRERA Portal (gujrera.gujarat.gov.in)",
  },
  {
    name: "Occupancy Certificate (OC)",
    description:
      "Certificate confirming the commercial premises are fit for occupation and use.",
    mandatory: true,
    source: "Municipal Corporation / Development Authority",
  },
  {
    name: "Completion Certificate (CC)",
    description:
      "Certificate confirming construction completion per approved commercial building plan.",
    mandatory: true,
    source: "Municipal Corporation / Development Authority",
  },
  {
    name: "Approved Building Plan",
    description:
      "Approved plan with FSI calculations, commercial use permission, and parking provisions.",
    mandatory: true,
    source: "Municipal Corporation / Development Authority",
  },
  {
    name: "Builder-Buyer Agreement",
    description:
      "Registered agreement for the commercial unit purchase.",
    mandatory: true,
    source: "Builder / Developer",
  },
  {
    name: "Shop & Establishment License",
    description:
      "License under the Gujarat Shops and Establishments Act for operating a business from the premises.",
    mandatory: true,
    source: "Municipal Corporation / Labour Department",
  },
  {
    name: "Fire NOC",
    description:
      "No Objection Certificate from the Fire Department confirming fire safety compliance of the building.",
    mandatory: true,
    source: "Fire & Emergency Services Department",
  },
  {
    name: "Society / Association NOC",
    description:
      "NOC from the commercial complex association for resale. Confirms no outstanding maintenance dues.",
    mandatory: true,
    source: "Commercial Complex Association",
  },
];

const PLOT_DOCUMENTS: DocumentRequirement[] = [
  ...COMMON_DOCUMENTS,
  {
    name: "NA Order (Non-Agricultural Conversion)",
    description:
      "Order from the Collector/Mamlatdar converting land from agricultural to non-agricultural use. Essential for plots.",
    mandatory: true,
    source: "Collector / Mamlatdar Office",
  },
  {
    name: "Layout Approval / TP Scheme",
    description:
      "Approved layout plan from the Town Planning authority or final TP scheme plot number allocation.",
    mandatory: true,
    source: "Development Authority (SUDA/AUDA etc.) / Town Planning Office",
  },
  {
    name: "Road Access Documentation",
    description:
      "Documentation proving legal road access to the plot. Verify approach road width and whether it is public or private.",
    mandatory: true,
    source: "Development Authority / Municipal Records",
  },
  {
    name: "Zone Certificate / Land Use Certificate",
    description:
      "Certificate confirming the land falls under the permitted zone (residential/commercial) in the development plan.",
    mandatory: true,
    source: "Development Authority / Town Planning Office",
  },
  {
    name: "Demarcation Map",
    description:
      "Surveyor's map showing exact plot boundaries, dimensions, and survey number boundaries.",
    mandatory: true,
    source: "Licensed Surveyor / Land Records Office",
  },
];

const DOCUMENT_MAP: Record<PropertyType, DocumentRequirement[]> = {
  residential_flat: RESIDENTIAL_FLAT_DOCUMENTS,
  commercial_office: COMMERCIAL_OFFICE_DOCUMENTS,
  plot: PLOT_DOCUMENTS,
  row_house: ROW_HOUSE_VILLA_DOCUMENTS,
  villa: ROW_HOUSE_VILLA_DOCUMENTS,
};

/**
 * Get the list of required documents for a given property type in Gujarat.
 *
 * @param type - The property type
 * @returns Array of document requirements with name, description, mandatory flag, and source
 */
export function getRequiredDocuments(type: PropertyType): DocumentRequirement[] {
  return DOCUMENT_MAP[type] ?? COMMON_DOCUMENTS;
}
