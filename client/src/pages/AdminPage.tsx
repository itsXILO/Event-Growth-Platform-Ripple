import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

interface TimelineItem {
  day: string;
  count: number;
  direct: number;
  referral: number;
  club: number;
}

interface CollegeItem {
  collegeId: number;
  collegeName: string;
  count: number;
}

interface SourceItem {
  source: string;
  count: number;
  key: string;
}

interface AnalyticsData {
  event: {
    title: string;
    capacity: number;
    startsAt: string;
  };
  kpis: {
    totalRegistrations: number;
    capacity: number;
    capacityPercentage: number;
    directCount: number;
    referralCount: number;
    clubCount: number;
    referralPercentage: number;
    uniqueCollegesCount: number;
    viralMultiplier: number;
  };
  timeline: TimelineItem[];
  byCollege: CollegeItem[];
  bySource: SourceItem[];
  bySemester: { semester: number; count: number }[];
  byBranch: { branch: string; count: number }[];
  roadmap: { feature: string; status: string }[];
}

const EVENT_SLUG = "nxtwave-ai-project-in-60-mins";

export function AdminPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/events/${EVENT_SLUG}/admin/analytics`)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load analytics:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const kpis = data?.kpis;
  const timeline = data?.timeline || [];
  const maxDaily = Math.max(...timeline.map((t) => t.count), 1);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Admin Growth Analytics
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                Single Event Mode
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Live registration metrics for "{data?.event?.title || "NxtWave AI Workshop"}"
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/leaderboard"
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 transition-colors"
            >
              Public Leaderboard ↗
            </Link>
            <Link
              to="/"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition-colors"
            >
              Registration Page ↗
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        {kpis && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <span className="text-xs font-medium text-gray-400 block">Total Registrations</span>
              <span className="text-3xl font-extrabold text-white mt-2 block">
                {kpis.totalRegistrations}
              </span>
              <span className="text-[11px] text-indigo-400 mt-1 block">
                {kpis.capacityPercentage}% of {kpis.capacity} capacity
              </span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <span className="text-xs font-medium text-gray-400 block">Referral Share</span>
              <span className="text-3xl font-extrabold text-indigo-400 mt-2 block">
                {kpis.referralPercentage}%
              </span>
              <span className="text-[11px] text-gray-400 mt-1 block">
                {kpis.referralCount} student referral signups
              </span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <span className="text-xs font-medium text-gray-400 block">Growth Multiplier (K-Factor)</span>
              <span className="text-3xl font-extrabold text-emerald-400 mt-2 block">
                {kpis.viralMultiplier}x
              </span>
              <span className="text-[11px] text-gray-400 mt-1 block">
                Organic virality via campus networks
              </span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <span className="text-xs font-medium text-gray-400 block">Active Campuses</span>
              <span className="text-3xl font-extrabold text-cyan-400 mt-2 block">
                {kpis.uniqueCollegesCount}
              </span>
              <span className="text-[11px] text-gray-400 mt-1 block">
                Engineering colleges represented
              </span>
            </div>
          </div>
        )}

        {/* Registrations Over Time (Timeline Bar Chart) */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Registrations Over Time</h2>
              <p className="text-xs text-gray-400">Daily registration volume across the 5-day growth sprint</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-gray-400">
                <span className="h-2.5 w-2.5 rounded bg-gray-500" /> Direct
              </span>
              <span className="flex items-center gap-1.5 text-indigo-400">
                <span className="h-2.5 w-2.5 rounded bg-indigo-500" /> Referral
              </span>
              <span className="flex items-center gap-1.5 text-cyan-400">
                <span className="h-2.5 w-2.5 rounded bg-cyan-500" /> Club Link
              </span>
            </div>
          </div>

          <div className="pt-6">
            <div className="grid grid-cols-6 gap-2 sm:gap-4 h-48 items-end">
              {timeline.map((item) => {
                const heightPercent = Math.max(12, Math.round((item.count / maxDaily) * 100));
                return (
                  <div key={item.day} className="flex flex-col items-center h-full justify-end group">
                    <span className="text-[11px] font-semibold text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                      {item.count}
                    </span>
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-indigo-700 via-indigo-500 to-cyan-400 transition-all duration-300 group-hover:brightness-110 flex flex-col justify-end overflow-hidden"
                      style={{ height: `${heightPercent}%` }}
                    >
                      {/* Visual segment for breakdown */}
                      <div
                        className="bg-cyan-500/80 w-full"
                        style={{ height: `${(item.club / (item.count || 1)) * 100}%` }}
                      />
                      <div
                        className="bg-indigo-500 w-full"
                        style={{ height: `${(item.referral / (item.count || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 mt-2 truncate w-full text-center">
                      {item.day.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2-Column Grid: By Source & By College */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Source Breakdown */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white">Registrations by Source</h2>
            <div className="space-y-4 pt-2">
              {(data?.bySource || []).map((src) => {
                const total = kpis?.totalRegistrations || 1;
                const percent = Math.round((src.count / total) * 100);
                const color =
                  src.key === "referral"
                    ? "bg-indigo-500"
                    : src.key === "club_link"
                    ? "bg-cyan-500"
                    : "bg-gray-400";

                return (
                  <div key={src.source} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-gray-200">{src.source}</span>
                      <span className="text-gray-400">
                        {src.count} signups ({percent}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By College Breakdown */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white">Top Colleges by Registration Volume</h2>
            <div className="space-y-3 pt-1 max-h-64 overflow-y-auto pr-1">
              {(data?.byCollege || []).slice(0, 7).map((col) => {
                const maxColCount = data?.byCollege[0]?.count || 1;
                const percent = Math.round((col.count / maxColCount) * 100);
                return (
                  <div key={col.collegeId} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-gray-300 truncate max-w-[240px]">
                        {col.collegeName}
                      </span>
                      <span className="font-semibold text-white">{col.count}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Future Product Roadmap Section (Explicitly out-of-scope items) */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-gray-900/60 to-gray-950 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🗺️</span>
            <div>
              <h2 className="text-base font-bold text-white">Product Roadmap (Future Phases)</h2>
              <p className="text-xs text-gray-400">
                Out-of-scope for current build — planned for future platform expansion
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {(data?.roadmap || []).map((item) => (
              <div
                key={item.feature}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-200">{item.feature}</span>
                </div>
                <span className="text-[10px] text-indigo-400 font-mono block">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
