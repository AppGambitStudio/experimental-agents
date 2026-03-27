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
