"use client";

import React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, ArrowRight, X } from "lucide-react";

export default function ProactiveIntelBanner() {
  const queryClient = useQueryClient();

  const { data } = useQuery<{
    ok: boolean;
    notification?: {
      title: string;
      body: string;
      route: string;
      sessionDate: string;
      createdAt: string;
    } | null;
  }>({
    queryKey: ["latest-proactive-notification"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/latest");
      if (!res.ok) return { ok: false, notification: null };
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const dismissMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications/dismiss", { method: "POST" });
    },
    onSuccess: () => {
      void queryClient.setQueryData(["latest-proactive-notification"], { ok: true, notification: null });
    },
  });

  const notification = data?.notification;
  if (!notification) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-purple-950/40 p-4 shadow-lg backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Morning Intel</span>
              <span className="text-[11px] text-muted-foreground">• Today</span>
            </div>
            <h4 className="text-sm font-semibold text-foreground mt-0.5">{notification.title}</h4>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notification.body}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <Link
            href={notification.route || "/"}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition"
          >
            <span>View Setup</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => dismissMutation.mutate()}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground transition"
            title="Dismiss notice"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

