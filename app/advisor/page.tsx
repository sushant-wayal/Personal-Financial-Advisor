import ChatClient from "./ChatClient";

export default function AdvisorPage() {
    return (
        <div className="mx-auto h-full max-w-8xl space-y-6 px-0 sm:px-0 lg:px-0">
            <div>
                <div className="text-sm font-semibold text-foreground">AI Financial Advisor</div>
                <div className="text-xs text-muted-foreground">Ask questions and get clear next steps</div>
            </div>
            <ChatClient />
        </div>
    );
}
