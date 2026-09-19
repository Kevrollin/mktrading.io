export interface ApprovalRow {
  adminUserId: string;
  createdAt: string;
}

export function ApprovalProgress({ approvals, required }: { approvals: ApprovalRow[]; required: number }) {
  const pct = Math.min(100, (approvals.length / required) * 100);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm font-medium text-foreground">
          {approvals.length} / {required}
        </span>
      </div>
      {approvals.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {approvals.map((approval) => (
            <li key={approval.adminUserId}>
              Admin {approval.adminUserId.slice(0, 8)} — {new Date(approval.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
