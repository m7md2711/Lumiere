import { priorityLabel, statusLabel } from "@/lib/i18n";
import { formatDateTime } from "@/lib/time";

/**
 * Dark ground: a dim tinted surface with bright type, never a light chip.
 * The colours follow the workflow rather than decorating it — gold is work
 * nobody has touched, green is finished, and the stages in between warm up as
 * a case moves. Closed is the only one that also recedes the whole row.
 */
const statusStyles: Record<string, string> = {
  new: "bg-clinic-50 text-clinic-700 ring-clinic-300",
  opened: "bg-sky-950/70 text-sky-300 ring-sky-900",
  under_review: "bg-amber-950/70 text-amber-300 ring-amber-900",
  solved: "bg-violet-950/70 text-violet-300 ring-violet-900",
  escalated: "bg-orange-950/70 text-orange-300 ring-orange-900",
  follow_up: "bg-indigo-950/70 text-indigo-300 ring-indigo-900",
  closed: "bg-emerald-950/80 text-emerald-300 ring-emerald-800",

  // Retained so rows written before the workflow changed still read sensibly.
  assigned: "bg-clinic-50 text-clinic-700 ring-clinic-200",
  in_progress: "bg-amber-950/70 text-amber-300 ring-amber-900",
  refund_approved: "bg-violet-950/70 text-violet-300 ring-violet-900",
  resolved: "bg-emerald-950/70 text-emerald-300 ring-emerald-900",
};

/** An unknown status should look unknown, not quietly borrow another's colour. */
const unknownStatus = "bg-slate-200 text-slate-500 ring-slate-300";

/**
 * Row treatment. A closed case needs nothing from anybody, so it steps back
 * and lets the open work hold the eye — it brightens again on hover so it
 * stays readable when you do want it.
 */
export function rowTone(status: string): string {
  return status === "closed"
    ? "border-emerald-900/40 opacity-60 transition-opacity hover:opacity-100"
    : "";
}

export function isClosed(status: string): boolean {
  return status === "closed";
}

const priorityStyles: Record<string, string> = {
  low: "bg-slate-200 text-slate-500 ring-slate-300",
  normal: "bg-sky-950/70 text-sky-300 ring-sky-900",
  high: "bg-amber-950/70 text-amber-300 ring-amber-900",
  urgent: "bg-rose-950/70 text-rose-300 ring-rose-900",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
        statusStyles[status] ?? unknownStatus
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
        priorityStyles[priority] ?? priorityStyles.normal
      }`}
    >
      {priorityLabel(priority)}
    </span>
  );
}

export function OverduePill() {
  return (
    <span className="inline-flex rounded-full bg-rose-600 px-2.5 py-1 text-xs font-semibold text-slate-950">
      Overdue
    </span>
  );
}

export function shortDate(iso: string): string {
  return formatDateTime(iso);
}
