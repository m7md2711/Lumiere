import { priorityLabel, statusLabel } from "@/lib/i18n";

const statusStyles: Record<string, string> = {
  new: "bg-sky-50 text-sky-700 ring-sky-100",
  assigned: "bg-clinic-50 text-clinic-700 ring-clinic-100",
  in_progress: "bg-amber-50 text-amber-700 ring-amber-100",
  escalated: "bg-orange-50 text-orange-700 ring-orange-100",
  refund_approved: "bg-violet-50 text-violet-700 ring-violet-100",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  closed: "bg-slate-100 text-slate-600 ring-slate-200",
};

const priorityStyles: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 ring-slate-200",
  normal: "bg-sky-50 text-sky-700 ring-sky-100",
  high: "bg-amber-50 text-amber-800 ring-amber-200",
  urgent: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
        statusStyles[status] ?? statusStyles.closed
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
    <span className="inline-flex rounded-full bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white">
      Overdue
    </span>
  );
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
