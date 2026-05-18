import ChatClient from "./ChatClient";

export default function AdvisorPage() {
    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div>
                <div className="text-sm font-semibold text-foreground">AI Financial Advisor</div>
                <div className="text-xs text-muted-foreground">Ask questions and get clear next steps</div>
            </div>
            <ChatClient />
        </div>
    );
}
