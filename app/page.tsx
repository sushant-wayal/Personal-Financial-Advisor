import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import DashboardOverview from "./components/DashboardOverview";

export default function Home() {
  return (
    <div className="h-screen overflow-hidden">
      <div className="flex h-full">
        <Sidebar />
        <div className="flex-1 overflow-y-auto">
          <Header />
          <main id="main" className="px-6 py-8 lg:px-10">
            <div className="mx-auto max-w-6xl">
              <DashboardOverview />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
