"use client";
import React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label?: string };

export default function Input({ label, className = "", ...props }: Props) {
    return (
        <div className="flex flex-col gap-1">
            {label && <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>}
            <input
                className={`h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${className}`}
                {...props}
            />
        </div>
    );
}
