import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** A map of the API, readable without a key so integrators can find their way. */
export async function GET() {
  return ok({
    name: "Lumiere Patient Feedback API",
    auth: "Send `Authorization: Bearer <key>`. Keys are created by the administrator in Settings.",
    scope: "A branch-bound key only ever sees that branch, whatever is asked for.",
    endpoints: [
      { method: "GET", path: "/api/v1/summary", query: "days (1–365, default 30), branch (codes, clinic-wide keys only)" },
      { method: "GET", path: "/api/v1/cases", query: "status, category, priority, source, branch, from, to (yyyy-mm-dd), q, overdue=1, limit (≤200), offset" },
      { method: "GET", path: "/api/v1/cases/{ref}", query: "—" },
      { method: "GET", path: "/api/v1/branches", query: "—" },
    ],
  });
}
