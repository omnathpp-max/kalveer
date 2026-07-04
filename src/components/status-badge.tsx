import { cn } from "@/lib/utils";

export type Status = "pending" | "approved" | "rejected" | "processing" | "paid" | "submitted";

const styles: Record<Status, string> = {
  submitted: "bg-slate-100 text-slate-700 border-slate-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  processing: "bg-sky-100 text-sky-800 border-sky-200",
  paid: "bg-green-600 text-white border-green-700",
};

const labels: Record<Status, string> = {
  submitted: "Submitted",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  processing: "Processing",
  paid: "Paid",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[status],
        className,
      )}
    >
      {labels[status]}
    </span>
  );
}
