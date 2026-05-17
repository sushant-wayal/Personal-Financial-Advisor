"use client";
import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "default" | "outline" | "ghost" | "destructive" | "secondary";
    size?: "sm" | "md" | "lg" | "icon";
};

export default function Button({ className = "", variant = "default", size = "md", ...props }: Props) {
    const base =
        "inline-flex items-center justify-center rounded-md font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:pointer-events-none disabled:opacity-60";
    const variants: Record<string, string> = {
        default: "bg-white text-slate-950 hover:bg-slate-100",
        secondary: "bg-white/10 text-white hover:bg-white/15",
        outline: "border border-white/10 bg-transparent text-white hover:bg-white/5",
        ghost: "bg-transparent text-white hover:bg-white/10",
        destructive: "bg-red-500 text-white hover:bg-red-400",
    };
    const sizes: Record<string, string> = {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        lg: "h-11 px-5 text-sm",
        icon: "h-9 w-9",
    };

    return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}
