"use client";
import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
    const [dark, setDark] = useState(false);

    useEffect(() => {
        const isDark = document.documentElement.classList.contains("dark");
        setDark(isDark);
    }, []);

    function toggle() {
        const el = document.documentElement;
        if (el.classList.contains("dark")) {
            el.classList.remove("dark");
            setDark(false);
        } else {
            el.classList.add("dark");
            setDark(true);
        }
    }

    return (
        <Button aria-pressed={dark} aria-label="Toggle theme" onClick={toggle} variant="ghost" size="icon">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
        </Button>
    );
}
