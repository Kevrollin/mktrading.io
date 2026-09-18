"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/auth/csrf-client";

export interface SessionRow {
  id: string;
  lastActiveAt: string;
  userAgent: string | null;
  ip: string | null;
  isCurrent: boolean;
}

export function SessionsList({ sessions: initialSessions }: { sessions: SessionRow[] }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  async function revoke(id: string) {
    setRevokingId(id);
    try {
      await apiFetch(`/api/account/sessions/${id}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((session) => session.id !== id));
    } finally {
      setRevokingId(null);
    }
  }

  async function revokeAllOthers() {
    setRevokingAll(true);
    try {
      await apiFetch("/api/account/sessions/revoke-all", { method: "POST" });
      setSessions((prev) => prev.filter((session) => session.isCurrent));
    } finally {
      setRevokingAll(false);
    }
  }

  const hasOtherSessions = sessions.some((session) => !session.isCurrent);

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Active sessions</h2>
        {hasOtherSessions ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={revokeAllOthers}
            disabled={revokingAll}
          >
            {revokingAll ? "Signing out..." : "Log out everywhere else"}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-border p-3"
          >
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">
                  {session.userAgent ?? "Unknown device"}
                </p>
                {session.isCurrent ? <Badge variant="positive">This device</Badge> : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {session.ip ?? "Unknown IP"} · last active{" "}
                {new Date(session.lastActiveAt).toLocaleString()}
              </p>
            </div>
            {!session.isCurrent ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => revoke(session.id)}
                disabled={revokingId === session.id}
              >
                {revokingId === session.id ? "Revoking..." : "Revoke"}
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
