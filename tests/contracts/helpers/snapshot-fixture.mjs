/**
 * Snapshot builders for contract tests.
 *
 * One source of truth per document body: every body comes from the canonical
 * fixture under fixtures/valid, so a fixture change cannot leave a test
 * asserting against a stale copy.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const VALID_DIR = join(ROOT, "fixtures", "valid");

export const loadJson = (path) => JSON.parse(readFileSync(path, "utf8"));
export const loadValid = (name) => loadJson(join(VALID_DIR, `${name}.json`));

const PLAN_REVISION = "694ff4bb-73ee-54e9-b6ec-50e57bf88bb4";
const REPORT_REVISION = "509a5bf9-2ac6-5bee-8335-1cfa4304de65";

/** Wrap a document body in the host revision envelope. */
export function envelope(documentKey, revisionId, revisionNumber, body) {
  return {
    documentKey,
    issueId: "0d1e3f9a-6b52-53f1-9c4a-1f2b3c4d5e6f",
    revisionId,
    revisionNumber,
    body,
  };
}

/** A structurally sound snapshot for the `validation` phase. */
export function validSnapshot() {
  return {
    schemaVersion: 1,
    paperclip: {
      companyId: "892939c1-04f2-5de3-8a00-0830f676c226",
      missionGoalId: "3a0c77ec-db9a-5f00-a5a0-381ccc3711a6",
      charter: envelope("mission-charter", PLAN_REVISION, 3, loadValid("mission-charter")),
      phasePlan: envelope("phase-plan", PLAN_REVISION, 3, loadValid("phase-plan")),
      evidence: [
        {
          validationContract: envelope(
            "phase-validation-contract",
            "06a9491d-ec54-504d-a14b-c8de9996ab82",
            1,
            loadValid("validation-contract"),
          ),
          validationReport: envelope(
            "phase-validation-report",
            REPORT_REVISION,
            2,
            loadValid("phase-validation-report"),
          ),
        },
      ],
    },
    operations: { transition: null, phaseBindings: [] },
  };
}
