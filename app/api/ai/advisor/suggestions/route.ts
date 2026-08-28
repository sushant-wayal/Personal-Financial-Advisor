import { NextResponse } from "next/server";
import { getAdvisorDynamicSuggestions } from "@/src/services/advisorSuggestions";

export async function GET() {
    try {
        const suggestions = await getAdvisorDynamicSuggestions();
        return NextResponse.json({ suggestions }, { headers: { "Cache-Control": "no-store" } });
    } catch (error: unknown) {
        console.error("[advisor/suggestions] Route error:", error);
        return NextResponse.json({
            suggestions: [
                "Can I afford a purchase right now?",
                "What should my priority be this month?",
                "How far am I from my target date?",
            ],
        });
    }
}

