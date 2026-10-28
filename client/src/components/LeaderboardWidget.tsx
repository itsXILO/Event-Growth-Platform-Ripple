import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";

export interface CollegeRanking {
  rank: number;
  id: number;
  name: string;
  count: number;
  totalRegistrations: number;
  breakdown: {
    direct: number;
    referral: number;
    clubLink: number;
  };
}

export interface ClubRanking {
  rank: number;
  id: number;
  name: string;
  parentCollegeName: string;
  count: number;
  totalRegistrations: number;
}

export interface ChampionRanking {
  rank: number;
  id: number;
  name: string;
  collegeName: string;
  referralCode: string;
  count: number;
  referralCount: number;
}

export interface LeaderboardResponse {
  event: {
    id: number;
    slug: string;
    title: string;
    startsAt?: string;
    capacity: number;
    totalRegistrations: number;
  };
  colleges: CollegeRanking[];
  clubs: ClubRanking[];
  referrers?: ChampionRanking[];
  topIndividualReferrers?: ChampionRanking[];
  champions?: ChampionRanking[];
  updatedAt: string;
}

interface LeaderboardWidgetProps {
  slug?: string;
  isEmbedded?: boolean;
  userCollegeId?: number | null;
  onSelectCollege?: (collegeId: number) => void;
}

const DEFAULT_SLUG = "nxtwave-ai-project-in-60-mins";

export function LeaderboardWidget({
  slug = DEFAULT_SLUG,
  isEmbedded = false,
  userCollegeId: propUserCollegeId,
  onSelectCollege,
}: LeaderboardWidgetProps) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"colleges" | "clubs" | "individuals">("colleges");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("just now");

  // College selected by user to track competition
  const [selectedCollegeId, setSelectedCollegeId] = useState<number | null>(() => {
    if (propUserCollegeId) return propUserCollegeId;
    const stored = localStorage.getItem("ripple_user_college_id");
    return stored ? Number(stored) : null;
  });

  // Fetch leaderboard data from API
  const fetchLeaderboard = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(`/api/events/${slug}/leaderboard`);
      if (res.ok) {
        const json: LeaderboardResponse = await res.json();
        setData(json);
        setLastUpdated("just now");
      }
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
    } finally {
      setLoading(false);
      if (isManual) {
        setTimeout(() => setRefreshing(false), 400);
      }
    }
  }, [slug]);

  // Poll API every 10 seconds as specified in Step 9
  useEffect(() => {
    fetchLeaderboard();

    const pollInterval = setInterval(() => {
      fetchLeaderboard();
    }, 10000); // 10 seconds

    return () => clearInterval(pollInterval);
  }, [fetchLeaderboard]);

  // Update "last updated" ticker every 2 seconds
  useEffect(() => {
    const ticker = setInterval(() => {
      if (!data?.updatedAt) return;
      const secondsAgo = Math.floor(
        (Date.now() - new Date(data.updatedAt).getTime()) / 1000
      );
      if (secondsAgo < 5) setLastUpdated("just now");
      else setLastUpdated(`${secondsAgo}s ago`);
    }, 2000);

    return () => clearInterval(ticker);
  }, [data?.updatedAt]);

  // Sync prop changes
  useEffect(() => {
    if (propUserCollegeId) {
      setSelectedCollegeId(propUserCollegeId);
    }
  }, [propUserCollegeId]);

  const colleges = useMemo(() => data?.colleges || [], [data?.colleges]);
  const clubs = useMemo(() => data?.clubs || [], [data?.clubs]);
  const individuals = useMemo(
    () => data?.champions || data?.referrers || data?.topIndividualReferrers || [],
    [data?.champions, data?.referrers, data?.topIndividualReferrers]
  );

  // Filtered lists based on search
  const filteredColleges = useMemo(() => {
    if (!search.trim()) return colleges;
    const q = search.toLowerCase();
    return colleges.filter((c) => c.name.toLowerCase().includes(q));
  }, [colleges, search]);

  const filteredClubs = useMemo(() => {
    if (!search.trim()) return clubs;
    const q = search.toLowerCase();
    return clubs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.parentCollegeName && c.parentCollegeName.toLowerCase().includes(q))
    );
  }, [clubs, search]);

  const filteredIndividuals = useMemo(() => {
    if (!search.trim()) return individuals;
    const q = search.toLowerCase();
    return individuals.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.collegeName && i.collegeName.toLowerCase().includes(q)) ||
        (i.referralCode && i.referralCode.toLowerCase().includes(q))
    );
  }, [individuals, search]);

  // Maximum registration counts for relative progress bars
  const maxCollegeCount = useMemo(() => {
    return Math.max(...colleges.map((c) => c.totalRegistrations ?? c.count ?? 0), 1);
  }, [colleges]);

  const maxClubCount = useMemo(() => {
    return Math.max(...clubs.map((c) => c.totalRegistrations ?? c.count ?? 0), 1);
  }, [clubs]);

  const maxIndividualCount = useMemo(() => {
    return Math.max(...individuals.map((i) => i.referralCount ?? i.count ?? 0), 1);
  }, [individuals]);

  // Find user's tracked college ranking & competitive gap calculation
  const trackedCollege = useMemo(() => {
    if (!selectedCollegeId) {
      // Default to #4 if available to immediately showcase the competitive banner
      return colleges.length >= 4 ? colleges[3] : colleges[0] || null;
    }
    return colleges.find((c) => c.id === selectedCollegeId) || colleges[0] || null;
  }, [colleges, selectedCollegeId]);

  const competitiveGap = useMemo(() => {
    if (!trackedCollege || colleges.length === 0) return null;

    const rank = trackedCollege.rank;
    const myCount = trackedCollege.totalRegistrations ?? trackedCollege.count ?? 0;

    if (rank === 1) {
      // Leader: calculate lead over #2
      const rank2 = colleges.find((c) => c.rank === 2);
      const lead = rank2 ? myCount - (rank2.totalRegistrations ?? rank2.count ?? 0) : 0;
      return {
        isLeader: true,
        rank: 1,
        lead,
        collegeName: trackedCollege.name,
        targetCollegeName: rank2?.name || "the runner-up",
      };
    }

    // Rank > 1: calculate gap to reach rank - 1
    const targetRank = rank - 1;
    const targetCollege = colleges.find((c) => c.rank === targetRank);
    const targetCount = targetCollege
      ? targetCollege.totalRegistrations ?? targetCollege.count ?? 0
      : myCount;
    const gap = targetCount - myCount;
    // Difference to overtake: if tied, need 1 more; if behind by gap, need gap to tie or gap + 1 to overtake
    const moreToReach = gap <= 0 ? 1 : gap;

    return {
      isLeader: false,
      rank,
      targetRank,
      moreToReach,
      collegeName: trackedCollege.name,
      targetCollegeName: targetCollege?.name || `Rank #${targetRank}`,
    };
  }, [trackedCollege, colleges]);

  // Top 3 Podium items for active tab
  const top3Podium = useMemo(() => {
    if (activeTab === "colleges") {
      return colleges.slice(0, 3).map((c) => ({
        rank: c.rank,
        title: c.name,
        subtitle: `${c.breakdown?.direct ?? 0} direct · ${c.breakdown?.referral ?? 0} ref`,
        count: c.totalRegistrations ?? c.count ?? 0,
        unit: "registrations",
      }));
    }
    if (activeTab === "clubs") {
      return clubs.slice(0, 3).map((c) => ({
        rank: c.rank,
        title: c.name,
        subtitle: c.parentCollegeName,
        count: c.totalRegistrations ?? c.count ?? 0,
        unit: "club signups",
      }));
    }
    return individuals.slice(0, 3).map((i) => ({
      rank: i.rank,
      title: i.name,
      subtitle: `${i.collegeName} (${i.referralCode})`,
      count: i.referralCount ?? i.count ?? 0,
      unit: "friends referred",
    }));
  }, [activeTab, colleges, clubs, individuals]);

  return (
    <div className="space-y-6">
      {/* ── Header & Polling Indicator ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <span>🏆</span>
              <span>Regional Growth Leaderboard</span>
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live · 10s poll</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Colleges, clubs, and student leaders battling for #1 on the regional scoreboard.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="text-[11px] text-gray-500 font-mono hidden md:block">
            Updated {lastUpdated}
          </div>

          <button
            onClick={() => fetchLeaderboard(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300 hover:text-white transition-colors cursor-pointer"
            title="Poll API immediately"
          >
            <span className={`text-sm ${refreshing ? "animate-spin text-indigo-400" : ""}`}>
              🔄
            </span>
            <span>{refreshing ? "Updating..." : "Refresh"}</span>
          </button>

          {isEmbedded && (
            <Link
              to="/leaderboard"
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/30 text-indigo-200 text-xs font-semibold transition-colors flex items-center gap-1"
            >
              <span>Full View</span>
              <span>↗</span>
            </Link>
          )}
        </div>
      </div>

      {/* ── Competitive Callout Banner ────────────────────────────────────────── */}
      {competitiveGap && (
        <div className="rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950/70 via-purple-950/40 to-gray-900 p-4 sm:p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start gap-3.5">
              <div className="text-3xl mt-0.5">
                {competitiveGap.isLeader ? "👑" : "🔥"}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                    Live Campus Rivalry
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/10">
                    Tracking: <strong className="text-white">{competitiveGap.collegeName}</strong>
                  </span>
                </div>

                {competitiveGap.isLeader ? (
                  <p className="text-sm sm:text-base font-semibold text-white">
                    Your college is <span className="text-amber-300 font-extrabold">#1 Champion</span>!{" "}
                    Leading {competitiveGap.targetCollegeName} by{" "}
                    <span className="text-emerald-400 font-bold">{competitiveGap.lead} registrations</span>. Keep defending the crown!
                  </p>
                ) : (
                  <p className="text-sm sm:text-base font-semibold text-white">
                    Your college is <span className="text-indigo-300 font-extrabold">#{competitiveGap.rank}</span>. Just{" "}
                    <span className="text-amber-400 font-extrabold underline decoration-amber-400/50 underline-offset-4">
                      {competitiveGap.moreToReach} more {competitiveGap.moreToReach === 1 ? "registration" : "registrations"}
                    </span>{" "}
                    to reach <span className="text-cyan-300 font-bold">#{competitiveGap.targetRank}</span> ({competitiveGap.targetCollegeName})!
                  </p>
                )}
              </div>
            </div>

            {/* Quick College Switcher */}
            <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
              <label htmlFor="college-tracker-select" className="text-xs text-gray-400 hidden lg:block">Track Squad:</label>
              <select
                id="college-tracker-select"
                aria-label="Track your college squad"
                value={trackedCollege?.id || ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedCollegeId(id);
                  localStorage.setItem("ripple_user_college_id", String(id));
                  onSelectCollege?.(id);
                }}
                className="bg-gray-900 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.rank} {c.name} ({c.totalRegistrations ?? c.count ?? 0})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Top 3 Podium (Active Tab) ─────────────────────────────────────────── */}
      {top3Podium.length >= 3 && !search && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
          {/* 2nd Place (Silver) */}
          <div className="order-2 md:order-1 rounded-2xl border border-slate-400/30 bg-gradient-to-b from-slate-900/60 via-gray-900 to-gray-950 p-5 text-center relative flex flex-col justify-between shadow-lg">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-500 flex items-center gap-1 shadow">
              <span>🥈</span>
              <span>2nd Place</span>
            </div>
            <div className="pt-3">
              <h3 className="font-bold text-white text-sm sm:text-base leading-snug line-clamp-2">
                {top3Podium[1].title}
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                {top3Podium[1].subtitle}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">
                {top3Podium[1].count}
              </span>
              <span className="text-[11px] text-gray-400 block mt-0.5">
                {top3Podium[1].unit}
              </span>
            </div>
          </div>

          {/* 1st Place (Gold Champion) */}
          <div className="order-1 md:order-2 rounded-2xl border border-amber-500/50 bg-gradient-to-b from-amber-950/40 via-gray-900 to-gray-950 p-5 text-center relative shadow-2xl shadow-amber-950/30 md:-translate-y-2 z-10 flex flex-col justify-between ring-1 ring-amber-500/20">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-gray-950 text-xs font-extrabold shadow-lg flex items-center gap-1">
              <span>👑</span>
              <span>1st Place Champion</span>
            </div>
            <div className="pt-4">
              <h3 className="font-extrabold text-white text-base sm:text-lg leading-snug line-clamp-2">
                {top3Podium[0].title}
              </h3>
              <p className="text-[11px] text-amber-200/70 mt-0.5 truncate">
                {top3Podium[0].subtitle}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-amber-500/20">
              <span className="text-3xl sm:text-4xl font-extrabold text-amber-300">
                {top3Podium[0].count}
              </span>
              <span className="text-[11px] text-amber-200/80 block mt-0.5 font-medium">
                {top3Podium[0].unit}
              </span>
            </div>
          </div>

          {/* 3rd Place (Bronze) */}
          <div className="order-3 md:order-3 rounded-2xl border border-amber-700/30 bg-gradient-to-b from-amber-950/20 via-gray-900 to-gray-950 p-5 text-center relative flex flex-col justify-between shadow-lg">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-800 text-amber-200 text-[11px] font-bold border border-amber-600 flex items-center gap-1 shadow">
              <span>🥉</span>
              <span>3rd Place</span>
            </div>
            <div className="pt-3">
              <h3 className="font-bold text-white text-sm sm:text-base leading-snug line-clamp-2">
                {top3Podium[2].title}
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                {top3Podium[2].subtitle}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">
                {top3Podium[2].count}
              </span>
              <span className="text-[11px] text-gray-400 block mt-0.5">
                {top3Podium[2].unit}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation Tabs & Search ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        {/* Tabs: Colleges, Clubs, Individuals */}
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
          <button
            onClick={() => setActiveTab("colleges")}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "colleges"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>🏛️ Colleges</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-white/15">
              {colleges.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("clubs")}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "clubs"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>⚡ Clubs</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-white/15">
              {clubs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("individuals")}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "individuals"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>👤 Individuals</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-white/15">
              {individuals.length}
            </span>
          </button>
        </div>

        {/* Filter / Search input */}
        <div className="relative max-w-xs w-full">
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl bg-gray-900 border border-white/10 px-3.5 py-2 text-xs sm:text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
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

      {/* ── Table & Progress Bars ────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-20 space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-xs text-gray-500">Loading live rankings...</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden shadow-2xl">
          {/* TAB 1: COLLEGES */}
          {activeTab === "colleges" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 border-b border-white/10 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 sm:px-6 w-16">Rank</th>
                    <th className="py-3 px-4 sm:px-6">College / Relative Lead</th>
                    <th className="py-3 px-4 sm:px-6 hidden sm:table-cell">Breakdown</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Registrations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredColleges.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-gray-500">
                        No colleges found matching "{search}".
                      </td>
                    </tr>
                  ) : (
                    filteredColleges.map((college, index) => {
                      const count = college.totalRegistrations ?? college.count ?? 0;
                      const progressPercent = Math.max(6, Math.round((count / maxCollegeCount) * 100));
                      const isTop3 = college.rank <= 3;
                      const isTracked = trackedCollege?.id === college.id;

                      // Competitive gap for this row
                      let competitiveTag: string | null = null;
                      if (college.rank === 1) {
                        const nextRank = filteredColleges[index + 1];
                        if (nextRank) {
                          const nextCount = nextRank.totalRegistrations ?? nextRank.count ?? 0;
                          const lead = count - nextCount;
                          competitiveTag = `👑 +${lead} lead over #2`;
                        }
                      } else {
                        const prevRank = filteredColleges[index - 1];
                        if (prevRank) {
                          const prevCount = prevRank.totalRegistrations ?? prevRank.count ?? 0;
                          const diff = prevCount - count;
                          const needed = diff <= 0 ? 1 : diff;
                          competitiveTag = `🔥 ${needed} more to reach #${college.rank - 1}`;
                        }
                      }

                      return (
                        <tr
                          key={college.id}
                          className={`transition-colors ${
                            isTracked
                              ? "bg-indigo-950/40 border-l-4 border-l-indigo-500"
                              : "hover:bg-white/[0.03]"
                          }`}
                        >
                          {/* Rank Badge */}
                          <td className="py-3.5 px-4 sm:px-6">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                                college.rank === 1
                                  ? "bg-amber-400 text-gray-950 shadow-md shadow-amber-500/20"
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

                          {/* College Name & Relative Progress Bar */}
                          <td className="py-3.5 px-4 sm:px-6">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`font-semibold ${
                                  isTop3 ? "text-white" : "text-gray-200"
                                }`}
                              >
                                {college.name}
                              </span>

                              {isTracked && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                                  YOUR SQUAD 🎯
                                </span>
                              )}

                              {competitiveTag && (
                                <span
                                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                    college.rank === 1
                                      ? "bg-amber-400/10 text-amber-300 border border-amber-400/20"
                                      : "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                                  }`}
                                >
                                  {competitiveTag}
                                </span>
                              )}
                            </div>

                            {/* Progress Bar showing relative lead */}
                            <div className="w-full max-w-xs sm:max-w-md h-2 rounded-full bg-white/5 mt-2 overflow-hidden p-0.5">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  college.rank === 1
                                    ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                                    : college.rank === 2
                                    ? "bg-gradient-to-r from-slate-400 to-slate-200"
                                    : college.rank === 3
                                    ? "bg-gradient-to-r from-amber-700 to-amber-500"
                                    : "bg-gradient-to-r from-indigo-500 to-cyan-400"
                                }`}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </td>

                          {/* Breakdown */}
                          <td className="py-3.5 px-4 sm:px-6 text-xs text-gray-400 hidden sm:table-cell">
                            <span className="text-gray-300">{college.breakdown?.direct ?? 0}</span> direct ·{" "}
                            <span className="text-indigo-300 font-medium">
                              {college.breakdown?.referral ?? 0}
                            </span> ref ·{" "}
                            <span className="text-cyan-300">{college.breakdown?.clubLink ?? 0}</span> club
                          </td>

                          {/* Total Count */}
                          <td className="py-3.5 px-4 sm:px-6 text-right">
                            <span className="text-base font-extrabold text-white">
                              {count}
                            </span>
                            <span className="text-[11px] text-gray-500 block">
                              registered
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: CLUBS */}
          {activeTab === "clubs" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 border-b border-white/10 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 sm:px-6 w-16">Rank</th>
                    <th className="py-3 px-4 sm:px-6">Club / Relative Lead</th>
                    <th className="py-3 px-4 sm:px-6 hidden sm:table-cell">Parent College</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Attributed Signups</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredClubs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-gray-500">
                        No clubs found matching "{search}".
                      </td>
                    </tr>
                  ) : (
                    filteredClubs.map((club, index) => {
                      const count = club.totalRegistrations ?? club.count ?? 0;
                      const progressPercent = Math.max(6, Math.round((count / maxClubCount) * 100));

                      let competitiveTag: string | null = null;
                      if (club.rank === 1) {
                        const nextRank = filteredClubs[index + 1];
                        if (nextRank) {
                          const nextCount = nextRank.totalRegistrations ?? nextRank.count ?? 0;
                          competitiveTag = `👑 +${count - nextCount} lead`;
                        }
                      } else {
                        const prevRank = filteredClubs[index - 1];
                        if (prevRank) {
                          const prevCount = prevRank.totalRegistrations ?? prevRank.count ?? 0;
                          const needed = Math.max(1, prevCount - count);
                          competitiveTag = `🔥 ${needed} more to reach #${club.rank - 1}`;
                        }
                      }

                      return (
                        <tr key={club.id} className="hover:bg-white/[0.03] transition-colors">
                          <td className="py-3.5 px-4 sm:px-6">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                                club.rank === 1
                                  ? "bg-amber-400 text-gray-950 shadow-md shadow-amber-500/20"
                                  : club.rank === 2
                                  ? "bg-slate-300 text-gray-950"
                                  : club.rank === 3
                                  ? "bg-amber-700 text-white"
                                  : "bg-white/10 text-gray-300"
                              }`}
                            >
                              {club.rank}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 sm:px-6">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-white">{club.name}</span>
                              {competitiveTag && (
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                                  {competitiveTag}
                                </span>
                              )}
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full max-w-xs sm:max-w-md h-2 rounded-full bg-white/5 mt-2 overflow-hidden p-0.5">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-400 transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </td>

                          <td className="py-3.5 px-4 sm:px-6 text-xs text-gray-400 hidden sm:table-cell">
                            {club.parentCollegeName}
                          </td>

                          <td className="py-3.5 px-4 sm:px-6 text-right">
                            <span className="text-base font-extrabold text-cyan-400">
                              {count}
                            </span>
                            <span className="text-[11px] text-gray-500 block">via club link</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: INDIVIDUALS */}
          {activeTab === "individuals" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 border-b border-white/10 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 sm:px-6 w-16">Rank</th>
                    <th className="py-3 px-4 sm:px-6">Student Champion / Lead</th>
                    <th className="py-3 px-4 sm:px-6 hidden sm:table-cell">College & Code</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Friends Referred</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredIndividuals.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-gray-500">
                        No individual referrers found matching "{search}".
                      </td>
                    </tr>
                  ) : (
                    filteredIndividuals.map((champ, index) => {
                      const count = champ.referralCount ?? champ.count ?? 0;
                      const progressPercent = Math.max(6, Math.round((count / maxIndividualCount) * 100));

                      let competitiveTag: string | null = null;
                      if (champ.rank === 1) {
                        const nextRank = filteredIndividuals[index + 1];
                        if (nextRank) {
                          const nextCount = nextRank.referralCount ?? nextRank.count ?? 0;
                          competitiveTag = `👑 +${count - nextCount} lead`;
                        }
                      } else {
                        const prevRank = filteredIndividuals[index - 1];
                        if (prevRank) {
                          const prevCount = prevRank.referralCount ?? prevRank.count ?? 0;
                          const needed = Math.max(1, prevCount - count);
                          competitiveTag = `🔥 ${needed} more to reach #${champ.rank - 1}`;
                        }
                      }

                      return (
                        <tr key={champ.id} className="hover:bg-white/[0.03] transition-colors">
                          <td className="py-3.5 px-4 sm:px-6">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                                champ.rank === 1
                                  ? "bg-amber-400 text-gray-950 shadow-md shadow-amber-500/20"
                                  : champ.rank === 2
                                  ? "bg-slate-300 text-gray-950"
                                  : champ.rank === 3
                                  ? "bg-amber-700 text-white"
                                  : "bg-white/10 text-gray-300"
                              }`}
                            >
                              {champ.rank}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 sm:px-6">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-white">{champ.name}</span>
                              {competitiveTag && (
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                  {competitiveTag}
                                </span>
                              )}
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full max-w-xs sm:max-w-md h-2 rounded-full bg-white/5 mt-2 overflow-hidden p-0.5">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </td>

                          <td className="py-3.5 px-4 sm:px-6 text-xs text-gray-400 hidden sm:table-cell">
                            <div>{champ.collegeName}</div>
                            <code className="text-[11px] font-mono text-indigo-300 bg-white/5 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                              {champ.referralCode}
                            </code>
                          </td>

                          <td className="py-3.5 px-4 sm:px-6 text-right">
                            <span className="text-base font-extrabold text-indigo-400">
                              {count}
                            </span>
                            <span className="text-[11px] text-gray-500 block">referred signups</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Bottom Call To Action ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-white text-sm sm:text-base">
            Want your college or club to climb to #1?
          </h4>
          <p className="text-xs text-gray-400 mt-0.5">
            Share your unique referral squad link with classmates and friends. Every registration counts!
          </p>
        </div>

        <Link
          to="/"
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all text-center whitespace-nowrap cursor-pointer"
        >
          Register & Boost College →
        </Link>
      </div>
    </div>
  );
}
