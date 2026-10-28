import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

interface CollegeRanking {
  rank: number;
  id: number;
  name: string;
  totalRegistrations: number;
  breakdown: {
    direct: number;
    referral: number;
    clubLink: number;
  };
}

interface ClubRanking {
  rank: number;
  id: number;
  name: string;
  parentCollegeName: string;
  totalRegistrations: number;
}

interface ChampionRanking {
  rank: number;
  id: number;
  name: string;
  collegeName: string;
  referralCode: string;
  referralCount: number;
}

interface LeaderboardData {
  event: {
    title: string;
    totalRegistrations: number;
    capacity: number;
  };
  colleges: CollegeRanking[];
  clubs: ClubRanking[];
  champions: ChampionRanking[];
  updatedAt: string;
}

const EVENT_SLUG = "nxtwave-ai-project-in-60-mins";

export function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [activeTab, setActiveTab] = useState<"colleges" | "clubs" | "champions">("colleges");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(`/api/events/${EVENT_SLUG}/leaderboard`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
    } finally {
      setLoading(false);
      if (isManual) setTimeout(() => setRefreshing(false), 500);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    // Auto-refresh leaderboard every 30 seconds
    const interval = setInterval(() => fetchLeaderboard(), 30000);
    return () => clearInterval(interval);
  }, []);

  const totalEventRegistrations = data?.event?.totalRegistrations || 1;

  // Filtered lists
  const filteredColleges = (data?.colleges || []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredClubs = (data?.clubs || []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.parentCollegeName.toLowerCase().includes(search.toLowerCase())
  );

  const filteredChampions = (data?.champions || []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.collegeName.toLowerCase().includes(search.toLowerCase())
  );

  // Top 3 Podium for colleges
  const top3 = (data?.colleges || []).slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                Live Community Leaderboard
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Colleges and student clubs competing for the NxtWave AI Workshop championship.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchLeaderboard(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              <span className={refreshing ? "animate-spin" : ""}>🔄</span>
              <span>{refreshing ? "Updating..." : "Refresh"}</span>
            </button>
            <Link
              to="/"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition-colors"
            >
              + Register & Boost College
            </Link>
          </div>
        </div>

        {/* Top 3 Podium (when on Colleges tab) */}
        {activeTab === "colleges" && top3.length >= 3 && !search && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* 2nd Place */}
            <div className="order-2 md:order-1 rounded-2xl border border-slate-400/30 bg-gradient-to-b from-slate-800/30 to-gray-950 p-5 text-center relative flex flex-col justify-between">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-slate-700 text-slate-200 text-xs font-bold border border-slate-500">
                🥈 2nd Place
              </div>
              <div className="pt-3">
                <h3 className="font-bold text-white text-base leading-tight mt-1">
                  {top3[1].name}
                </h3>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5">
                <span className="text-3xl font-extrabold text-white">{top3[1].totalRegistrations}</span>
                <span className="text-xs text-gray-400 block mt-0.5">student registrations</span>
              </div>
            </div>

            {/* 1st Place - Champion */}
            <div className="order-1 md:order-2 rounded-2xl border border-amber-500/50 bg-gradient-to-b from-amber-950/40 via-gray-900 to-gray-950 p-6 text-center relative shadow-xl shadow-amber-950/30 scale-105 z-10 flex flex-col justify-between">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-gray-950 text-xs font-extrabold shadow-md">
                👑 1st Place Champion
              </div>
              <div className="pt-4">
                <h3 className="font-extrabold text-white text-lg leading-tight mt-1">
                  {top3[0].name}
                </h3>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-500/20">
                <span className="text-4xl font-extrabold text-amber-300">{top3[0].totalRegistrations}</span>
                <span className="text-xs text-amber-200/70 block mt-0.5">student registrations</span>
              </div>
            </div>

            {/* 3rd Place */}
            <div className="order-3 md:order-3 rounded-2xl border border-amber-700/30 bg-gradient-to-b from-amber-950/20 to-gray-950 p-5 text-center relative flex flex-col justify-between">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-800 text-amber-200 text-xs font-bold border border-amber-600">
                🥉 3rd Place
              </div>
              <div className="pt-3">
                <h3 className="font-bold text-white text-base leading-tight mt-1">
                  {top3[2].name}
                </h3>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5">
                <span className="text-3xl font-extrabold text-white">{top3[2].totalRegistrations}</span>
                <span className="text-xs text-gray-400 block mt-0.5">student registrations</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Selection & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
            <button
              onClick={() => setActiveTab("colleges")}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === "colleges"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Colleges ({data?.colleges?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("clubs")}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === "clubs"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Clubs ({data?.clubs?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("champions")}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === "champions"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Student Champions ({data?.champions?.length || 0})
            </button>
          </div>

          <div className="relative max-w-xs w-full">
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl bg-gray-900 border border-white/10 px-4 py-2 text-xs sm:text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden shadow-xl">
            {activeTab === "colleges" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 border-b border-white/10 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6 w-16">Rank</th>
                      <th className="py-3.5 px-4 sm:px-6">College / Institution</th>
                      <th className="py-3.5 px-4 sm:px-6">Breakdown (Direct / Ref / Club)</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Total Registrations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredColleges.map((college) => {
                      const sharePercent = Math.round(
                        (college.totalRegistrations / totalEventRegistrations) * 100
                      );
                      const isTop3 = college.rank <= 3;
                      return (
                        <tr
                          key={college.id}
                          className="hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="py-4 px-4 sm:px-6">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                                college.rank === 1
                                  ? "bg-amber-500 text-gray-950"
                                  : college.rank === 2
                                  ? "bg-slate-300 text-gray-950"
                                  : college.rank === 3
                                  ? "bg-amber-700 text-white"
                                  : "bg-white/10 text-gray-300"
                              }`}
                            >
                              {college.rank}
                            </span>
                          </td>
                          <td className="py-4 px-4 sm:px-6">
                            <span className={`font-semibold ${isTop3 ? "text-white" : "text-gray-200"}`}>
                              {college.name}
                            </span>
                            <div className="w-32 sm:w-48 h-1.5 rounded-full bg-white/10 mt-1.5 overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${Math.min(100, sharePercent * 3)}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-4 px-4 sm:px-6 text-xs text-gray-400">
                            <span className="text-gray-300">{college.breakdown.direct}</span> direct ·{" "}
                            <span className="text-indigo-300 font-medium">{college.breakdown.referral}</span> referrals ·{" "}
                            <span className="text-cyan-300">{college.breakdown.clubLink}</span> clubs
                          </td>
                          <td className="py-4 px-4 sm:px-6 text-right">
                            <span className="text-base font-bold text-white">
                              {college.totalRegistrations}
                            </span>
                            <span className="text-xs text-gray-500 block">
                              ({sharePercent}% of total)
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "clubs" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 border-b border-white/10 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6 w-16">Rank</th>
                      <th className="py-3.5 px-4 sm:px-6">Club Community</th>
                      <th className="py-3.5 px-4 sm:px-6">Parent College</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Attributed Signups</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredClubs.map((club) => (
                      <tr key={club.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-4 px-4 sm:px-6">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-white/10 text-gray-300">
                            {club.rank}
                          </span>
                        </td>
                        <td className="py-4 px-4 sm:px-6">
                          <span className="font-semibold text-white">{club.name}</span>
                        </td>
                        <td className="py-4 px-4 sm:px-6 text-xs text-gray-400">
                          {club.parentCollegeName}
                        </td>
                        <td className="py-4 px-4 sm:px-6 text-right">
                          <span className="text-base font-bold text-cyan-400">
                            {club.totalRegistrations}
                          </span>
                          <span className="text-xs text-gray-500 block">via club links</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "champions" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 border-b border-white/10 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6 w-16">Rank</th>
                      <th className="py-3.5 px-4 sm:px-6">Student Ambassador</th>
                      <th className="py-3.5 px-4 sm:px-6">College</th>
                      <th className="py-3.5 px-4 sm:px-6">Referral Code</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Friends Referred</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredChampions.map((champ) => (
                      <tr key={champ.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-4 px-4 sm:px-6">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {champ.rank}
                          </span>
                        </td>
                        <td className="py-4 px-4 sm:px-6 font-semibold text-white">
                          {champ.name}
                        </td>
                        <td className="py-4 px-4 sm:px-6 text-xs text-gray-400">
                          {champ.collegeName}
                        </td>
                        <td className="py-4 px-4 sm:px-6">
                          <span className="font-mono text-xs px-2 py-1 rounded bg-white/5 text-gray-300 border border-white/10">
                            {champ.referralCode}
                          </span>
                        </td>
                        <td className="py-4 px-4 sm:px-6 text-right">
                          <span className="text-base font-bold text-indigo-400">
                            {champ.referralCount}
                          </span>
                          <span className="text-xs text-gray-500 block">referral signups</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
