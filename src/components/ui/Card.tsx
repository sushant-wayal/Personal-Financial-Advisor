"use client";
import React from "react";

export default function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`rounded-xl border border-white/10 bg-white/5 p-4 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.7)] backdrop-blur ${className}`}>
            {children}
        </div>
    );
}
