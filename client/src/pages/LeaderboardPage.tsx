import { LeaderboardWidget } from "../components/LeaderboardWidget";

export function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 py-10 px-4 sm:px-6 lg:px-8 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        <LeaderboardWidget isEmbedded={false} />
      </div>
    </div>
  );
}
