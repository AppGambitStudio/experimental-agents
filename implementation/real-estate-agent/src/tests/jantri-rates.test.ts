import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lookupJantriRate, SURAT_JANTRI_RATES } from "../knowledge-base/jantri-rates.js";

describe("SURAT_JANTRI_RATES", () => {
  it("has 7 zones", () => {
    assert.equal(SURAT_JANTRI_RATES.length, 7);
  });

  it("all zones have required fields", () => {
    for (const zone of SURAT_JANTRI_RATES) {
      assert.ok(zone.zone, `zone identifier missing`);
      assert.ok(zone.area, `area name missing for ${zone.zone}`);
      assert.ok(zone.residentialRate.min > 0, `residential min rate should be > 0 for ${zone.zone}`);
      assert.ok(zone.residentialRate.max >= zone.residentialRate.min, `residential max >= min for ${zone.zone}`);
      assert.ok(zone.commercialRate.min > 0, `commercial min rate should be > 0 for ${zone.zone}`);
      assert.ok(zone.commercialRate.max >= zone.commercialRate.min, `commercial max >= min for ${zone.zone}`);
      assert.equal(zone.unit, "sqft");
    }
  });

  it("commercial rates are higher than residential in all zones", () => {
    for (const zone of SURAT_JANTRI_RATES) {
      assert.ok(
        zone.commercialRate.min >= zone.residentialRate.min,
        `commercial min should be >= residential min in ${zone.zone}`
      );
    }
  });
});

describe("lookupJantriRate", () => {
  describe("lookup by zone ID", () => {
    it("finds zone_1", () => {
      const result = lookupJantriRate("zone_1", "residential_flat");
      assert.ok(result);
      assert.equal(result.area, "Athwa / Ghod Dod Road");
    });

    it("finds zone_7", () => {
      const result = lookupJantriRate("zone_7", "commercial_office");
      assert.ok(result);
      assert.equal(result.area, "Dumas / Suvali");
    });
  });

  describe("lookup by area name", () => {
    it("finds by partial area name 'athwa'", () => {
      const result = lookupJantriRate("athwa", "residential_flat");
      assert.ok(result);
      assert.equal(result.area, "Athwa / Ghod Dod Road");
    });

    it("finds by partial area name 'adajan'", () => {
      const result = lookupJantriRate("adajan", "residential_flat");
      assert.ok(result);
      assert.equal(result.area, "Adajan / Pal");
    });

    it("finds by partial area name 'vesu'", () => {
      const result = lookupJantriRate("vesu", "commercial_office");
      assert.ok(result);
      assert.equal(result.area, "Vesu / VIP Road");
    });
  });

  describe("case insensitivity", () => {
    it("handles uppercase input", () => {
      const result = lookupJantriRate("ZONE_1", "residential_flat");
      assert.ok(result);
    });

    it("handles mixed case area name", () => {
      const result = lookupJantriRate("Athwa", "residential_flat");
      assert.ok(result);
    });
  });

  describe("property type rate selection", () => {
    it("returns residential rate for residential_flat", () => {
      const result = lookupJantriRate("zone_1", "residential_flat");
      assert.ok(result);
      assert.equal(result.rate.min, 4500);
      assert.equal(result.rate.max, 6000);
    });

    it("returns commercial rate for commercial_office", () => {
      const result = lookupJantriRate("zone_1", "commercial_office");
      assert.ok(result);
      assert.equal(result.rate.min, 6000);
      assert.equal(result.rate.max, 9000);
    });

    it("returns residential rate for row_house", () => {
      const result = lookupJantriRate("zone_1", "row_house");
      assert.ok(result);
      assert.equal(result.rate.min, 4500);
    });

    it("returns residential rate for villa", () => {
      const result = lookupJantriRate("zone_1", "villa");
      assert.ok(result);
      assert.equal(result.rate.min, 4500);
    });

    it("returns residential rate for plot", () => {
      const result = lookupJantriRate("zone_1", "plot");
      assert.ok(result);
      assert.equal(result.rate.min, 4500);
    });
  });

  describe("not found", () => {
    it("returns undefined for unknown zone", () => {
      const result = lookupJantriRate("zone_99", "residential_flat");
      assert.equal(result, undefined);
    });

    it("returns undefined for unknown area name", () => {
      const result = lookupJantriRate("ahmedabad", "residential_flat");
      assert.equal(result, undefined);
    });
  });

  describe("whitespace handling", () => {
    it("trims input", () => {
      const result = lookupJantriRate("  zone_1  ", "residential_flat");
      assert.ok(result);
    });
  });
});
