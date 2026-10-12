import { priorityLabel, statusLabel } from "@/lib/i18n";
import { formatDateTime } from "@/lib/time";

/**
 * Dark ground: a dim tinted surface with bright type, never a light chip.
 * The colours follow the workflow rather than decorating it — gold is work
 * nobody has touched, green is finished, and the stages in between warm up as
 * a case moves. Closed is the only one that also recedes the whole row.
 */
const statusStyles: Record<string, string> = {
  new: "t-gold",
  opened: "t-info",
  under_review: "t-warn",
  solved: "t-hint",
  escalated: "t-warn",
  follow_up: "t-hint",
  closed: "t-ok",

  // Retained so rows written before the workflow changed still read sensibly.
  assigned: "t-gold",
  in_progress: "t-warn",
  refund_approved: "t-hint",
  resolved: "t-ok",
};

const priorityStyles: Record<string, string> = {
  low: "t-flat",
  normal: "t-info",
  high: "t-warn",
  urgent: "t-crit",
};

/** An unknown status should look unknown, not quietly borrow another's. */
const unknownStatus = "t-flat";

/**
 * Row treatment. A closed case needs nothing from anybody, so it steps back
 * and lets the open work hold the eye — it brightens again on hover so it
 * stays readable when you do want it.
 */
export function rowTone(status: string): string {
  return status === "closed"
    ? "opacity-60 transition-opacity hover:opacity-100"
    : "";
}

export function isClosed(status: string): boolean {
  return status === "closed";
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`pill ${statusStyles[status] ?? unknownStatus}`}>
      {statusLabel(status)}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: string }) {
  return (
    <span className={`pill ${priorityStyles[priority] ?? priorityStyles.normal}`}>
      {priorityLabel(priority)}
    </span>
  );
}

export function OverduePill() {
  return (
    <span className="pill t-crit font-medium">Overdue</span>
  );
}

export function shortDate(iso: string): string {
  return formatDateTime(iso);
}
