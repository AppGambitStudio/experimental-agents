// Surat zone-wise jantri (government ready reckoner) rates
// Source: Gujarat Revenue Department — effective rates for property valuation

import { JantriRate, PropertyType } from "../types/index.js";

export const SURAT_JANTRI_RATES: JantriRate[] = [
  {
    zone: "zone_1",
    area: "Athwa / Ghod Dod Road",
    residentialRate: { min: 4500, max: 6000 },
    commercialRate: { min: 6000, max: 9000 },
    unit: "sqft",
  },
  {
    zone: "zone_2",
    area: "Adajan / Pal",
    residentialRate: { min: 3500, max: 5000 },
    commercialRate: { min: 5000, max: 7500 },
    unit: "sqft",
  },
  {
    zone: "zone_3",
    area: "Vesu / VIP Road",
    residentialRate: { min: 4000, max: 5500 },
    commercialRate: { min: 5500, max: 8000 },
    unit: "sqft",
  },
  {
    zone: "zone_4",
    area: "Piplod / City Light",
    residentialRate: { min: 4000, max: 5500 },
    commercialRate: { min: 5500, max: 8000 },
    unit: "sqft",
  },
  {
    zone: "zone_5",
    area: "Katargam / Varachha",
    residentialRate: { min: 2500, max: 3500 },
    commercialRate: { min: 3500, max: 5000 },
    unit: "sqft",
  },
  {
    zone: "zone_6",
    area: "Udhna / Pandesara",
    residentialRate: { min: 2000, max: 3000 },
    commercialRate: { min: 3000, max: 4500 },
    unit: "sqft",
  },
  {
    zone: "zone_7",
    area: "Dumas / Suvali",
    residentialRate: { min: 1800, max: 2500 },
    commercialRate: { min: 2500, max: 4000 },
    unit: "sqft",
  },
];

/**
 * Look up jantri rate for a given zone and property type.
 * Returns the matching JantriRate entry or undefined if not found.
 *
 * @param zone - Zone identifier (e.g. "zone_1") or area name substring (e.g. "Athwa")
 * @param type - Property type to determine residential vs commercial rate
 */
export function lookupJantriRate(
  zone: string,
  type: PropertyType
): { rate: { min: number; max: number }; unit: string; area: string } | undefined {
  const normalizedZone = zone.toLowerCase().trim();

  const entry = SURAT_JANTRI_RATES.find(
    (r) =>
      r.zone.toLowerCase() === normalizedZone ||
      r.area.toLowerCase().includes(normalizedZone)
  );

  if (!entry) {
    return undefined;
  }

  const isCommercial = type === "commercial_office";
  const rate = isCommercial ? entry.commercialRate : entry.residentialRate;

  return {
    rate,
    unit: entry.unit,
    area: entry.area,
  };
}
