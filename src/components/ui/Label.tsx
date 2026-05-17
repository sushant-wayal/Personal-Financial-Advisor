"use client";
import React from "react";

export default function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return <label className={`text-xs font-semibold uppercase tracking-wide text-slate-400 ${className}`}>{children}</label>;
}
