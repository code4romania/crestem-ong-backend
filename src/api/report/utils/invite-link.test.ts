import { afterEach, describe, expect, it } from "vitest";
import { buildEvaluationLink } from "./invite-link";

const original = process.env.FRONTEND_URL;

afterEach(() => {
  process.env.FRONTEND_URL = original;
});

describe("buildEvaluationLink", () => {
  it("points at the respondent wizard, organization segment included", () => {
    // The route only answers under the organization the evaluation belongs to
    // (app/dashboard/user-ong/[ongDocumentId]/evaluari/[evaluationDocumentId]
    // in the frontend, with the role folder added by its proxy), so a link
    // without the organization documentId lands on a 404.
    process.env.FRONTEND_URL = "https://crestem.ong";

    expect(buildEvaluationLink("ong-1", "eval-1")).toBe(
      "https://crestem.ong/dashboard/ong-1/evaluari/eval-1",
    );
  });

  it("does not double the slash when the configured base ends in one", () => {
    process.env.FRONTEND_URL = "https://crestem.ong//";

    expect(buildEvaluationLink("ong-1", "eval-1")).toBe(
      "https://crestem.ong/dashboard/ong-1/evaluari/eval-1",
    );
  });
});
