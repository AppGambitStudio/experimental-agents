import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getRequiredDocuments } from "../knowledge-base/required-documents.js";
import type { PropertyType } from "../types/index.js";

describe("getRequiredDocuments", () => {
  const propertyTypes: PropertyType[] = [
    "residential_flat",
    "commercial_office",
    "plot",
    "row_house",
    "villa",
  ];

  for (const type of propertyTypes) {
    describe(type, () => {
      it("returns a non-empty document list", () => {
        const docs = getRequiredDocuments(type);
        assert.ok(docs.length > 0, `${type} should have documents`);
      });

      it("all documents have required fields", () => {
        const docs = getRequiredDocuments(type);
        for (const doc of docs) {
          assert.ok(doc.name, `name required for doc in ${type}`);
          assert.ok(doc.description, `description required for ${doc.name}`);
          assert.equal(typeof doc.mandatory, "boolean", `mandatory should be boolean for ${doc.name}`);
          assert.ok(doc.source, `source required for ${doc.name}`);
        }
      });

      it("includes common documents (Title Deed, 7/12, 8A, EC, Tax Receipt)", () => {
        const docs = getRequiredDocuments(type);
        const names = docs.map(d => d.name);
        assert.ok(names.some(n => n.includes("Title Deed")), `${type} should include Title Deed`);
        assert.ok(names.some(n => n.includes("Encumbrance")), `${type} should include Encumbrance Certificate`);
        assert.ok(names.some(n => n.includes("Property Tax")), `${type} should include Property Tax Receipt`);
      });
    });
  }

  describe("residential_flat specifics", () => {
    it("includes RERA, OC, CC, Society NOC", () => {
      const docs = getRequiredDocuments("residential_flat");
      const names = docs.map(d => d.name);
      assert.ok(names.some(n => n.includes("RERA")));
      assert.ok(names.some(n => n.includes("Occupancy")));
      assert.ok(names.some(n => n.includes("Completion")));
      assert.ok(names.some(n => n.includes("Society NOC")));
    });
  });

  describe("commercial_office specifics", () => {
    it("includes Fire NOC and Shop & Establishment", () => {
      const docs = getRequiredDocuments("commercial_office");
      const names = docs.map(d => d.name);
      assert.ok(names.some(n => n.includes("Fire NOC")));
      assert.ok(names.some(n => n.includes("Shop")));
    });
  });

  describe("plot specifics", () => {
    it("includes NA Order and Layout Approval", () => {
      const docs = getRequiredDocuments("plot");
      const names = docs.map(d => d.name);
      assert.ok(names.some(n => n.includes("NA Order")));
      assert.ok(names.some(n => n.includes("Layout")));
      assert.ok(names.some(n => n.includes("Demarcation")));
    });
  });

  describe("row_house and villa share the same document set", () => {
    it("row_house and villa have identical documents", () => {
      const rowHouse = getRequiredDocuments("row_house");
      const villa = getRequiredDocuments("villa");
      assert.deepEqual(
        rowHouse.map(d => d.name),
        villa.map(d => d.name)
      );
    });
  });
});
