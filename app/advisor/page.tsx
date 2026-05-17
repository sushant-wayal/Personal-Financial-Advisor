import ChatClient from "./ChatClient";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

export default function AdvisorPage() {
    return (
        <div className="min-h-screen">
            <div className="flex">
                <Sidebar />
                <div className="flex-1">
                    <Header />
                    <main id="main" className="px-6 py-8 lg:px-10">
                        <div className="mx-auto max-w-4xl space-y-6">
                            <div>
                                <div className="text-sm font-semibold text-white">AI Financial Advisor</div>
                                <div className="text-xs text-slate-400">Ask questions and get clear next steps</div>
                            </div>
                            <ChatClient />
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
