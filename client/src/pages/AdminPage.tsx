import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface TimelineItem {
  day: string;
  count: number;
  cumulative: number;
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
  fill?: string;
}

interface AnalyticsData {
  event: {
    id: number;
    slug: string;
    title: string;
    startsAt: string;
    capacity: number;
  };
  kpis: {
    totalRegistrations: number;
    goal: number;
    goalPercent: number;
    remainingToGoal: number;
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
}

interface RegistrationRow {
  id: number;
  name: string;
  email: string;
  collegeId: number;
  collegeName: string;
  semester: number;
  branch: string;
  source: "direct" | "referral" | "club_link";
  referralCode: string;
  referredByRegistrationId: number | null;
  referredByName: string | null;
  createdAt: string;
}

const EVENT_SLUG = "nxtwave-ai-project-in-60-mins";

export function AdminPage() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Analytics & Registrations data
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [totalRegistrationsCount, setTotalRegistrationsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Table filters & pagination
  const [tableSearch, setTableSearch] = useState("");
  const [tableLimit] = useState(25);
  const [tableOffset, setTableOffset] = useState(0);

  // 1. Check if user already has an active httpOnly session
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/check", {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setIsAuthenticated(Boolean(json.authenticated));
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 2. Fetch admin analytics data
  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/events/${EVENT_SLUG}/analytics`, {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setAnalytics(json);
      } else if (res.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    }
  }, []);

  // 3. Fetch recent registrations list
  const fetchRegistrations = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams({
        limit: String(tableLimit),
        offset: String(tableOffset),
        search: tableSearch.trim(),
      });
      const res = await fetch(
        `/api/admin/events/${EVENT_SLUG}/registrations?${queryParams.toString()}`,
        {
          credentials: "include",
        }
      );
      if (res.ok) {
        const json = await res.json();
        setRegistrations(json.registrations || []);
        setTotalRegistrationsCount(json.total || 0);
      } else if (res.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error("Failed to load registrations:", err);
    }
  }, [tableLimit, tableOffset, tableSearch]);

  // Load data once authenticated
  const loadAllData = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      setLoading(true);
      await Promise.all([fetchAnalytics(), fetchRegistrations()]);
      setLoading(false);
      if (isManual) {
        setTimeout(() => setRefreshing(false), 400);
      }
    },
    [fetchAnalytics, fetchRegistrations]
  );

  useEffect(() => {
    if (isAuthenticated) {
      loadAllData();
    }
  }, [isAuthenticated, loadAllData]);

  // Handle Login submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: passwordInput }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        setIsAuthenticated(true);
        setPasswordInput("");
      } else {
        setLoginError(result.error || "Authentication failed. Incorrect password.");
      }
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Network error. Try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setIsAuthenticated(false);
      setAnalytics(null);
      setRegistrations([]);
    }
  };

  // Handle CSV export
  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/events/${EVENT_SLUG}/export.csv`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${EVENT_SLUG}-registrations-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export CSV. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // ── Render: Checking session loader ──────────────────────────────────────────
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p className="text-xs text-gray-500 font-mono">Verifying admin session...</p>
      </div>
    );
  }

  // ── Render: Password Login Dialog ────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto text-2xl shadow-lg shadow-indigo-600/20">
              🔒
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Admin Portal
            </h1>
            <p className="text-xs text-gray-400">
              Protected by server-side password & httpOnly session cookie.
            </p>
          </div>

          {loginError && (
            <div className="rounded-xl bg-red-950/60 border border-red-500/40 p-3.5 text-xs text-red-300 flex items-center gap-2.5">
              <span>⚠️</span>
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoFocus
                  placeholder="Enter admin password..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full rounded-xl bg-gray-900 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-xs text-gray-400 hover:text-white"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5 flex items-center justify-between">
                <span>Default: <code className="text-gray-300">admin123</code></span>
                <span>(via ADMIN_PASSWORD)</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loginLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Unlock Admin Dashboard</span>
                  <span>→</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <Link to="/" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              ← Return to Workshop Landing Page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Authenticated Admin Portal ───────────────────────────────────────
  const kpis = analytics?.kpis;
  const timeline = analytics?.timeline || [];
  const byCollege = (analytics?.byCollege || []).slice(0, 10);
  const bySource = analytics?.bySource || [];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 py-8 px-4 sm:px-6 lg:px-8 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ── Top Header Bar ─────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>⚡</span>
                <span>Admin Growth Analytics</span>
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Protected</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Live funnel metrics & registrant database for "{analytics?.event?.title || "NxtWave AI Workshop"}"
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Refresh Button */}
            <button
              onClick={() => loadAllData(true)}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span className={refreshing ? "animate-spin" : ""}>🔄</span>
              <span>{refreshing ? "Refreshing..." : "Refresh Data"}</span>
            </button>

            {/* CSV Export Button (Step 10 Requirement) */}
            <button
              onClick={handleExportCsv}
              disabled={exporting}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>📥</span>
              <span>{exporting ? "Generating CSV..." : "Export CSV"}</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>

        {loading && !analytics ? (
          <div className="flex justify-center items-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* ── KPI Metric Cards: Conversion Towards 500 Goal ──────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: 500 Goal Progress */}
              <div className="rounded-2xl border border-indigo-500/40 bg-gradient-to-b from-indigo-950/40 via-gray-900 to-gray-950 p-5 space-y-3 relative overflow-hidden shadow-xl">
                <div className="flex justify-between items-center text-xs text-indigo-300 font-bold uppercase tracking-wider">
                  <span>Goal Conversion</span>
                  <span>🎯 500 Target</span>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-extrabold text-white">
                      {kpis?.totalRegistrations ?? 0}
                    </span>
                    <span className="text-gray-400 text-sm">/ 500</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-white/10 mt-3 overflow-hidden p-0.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 transition-all duration-700"
                      style={{ width: `${Math.min(100, kpis?.goalPercent ?? 0)}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-400 pt-1">
                  <span className="text-indigo-300 font-semibold">{kpis?.goalPercent ?? 0}% achieved</span>
                  <span className="text-amber-400 font-medium">
                    {kpis?.remainingToGoal ?? 0} remaining
                  </span>
                </div>
              </div>

              {/* Card 2: Student Referral Growth */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
                <div className="flex justify-between items-center text-xs text-purple-400 font-bold uppercase tracking-wider">
                  <span>Student Referrals</span>
                  <span>👥 Viral</span>
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white">
                  {kpis?.referralCount ?? 0}
                </div>
                <p className="text-xs text-gray-400">
                  <strong className="text-purple-300">{kpis?.referralPercentage ?? 0}%</strong> of all signups came via student squad invites.
                </p>
                <div className="text-[11px] text-gray-500 pt-1 border-t border-white/5">
                  Viral multiplier: <strong className="text-white">{kpis?.viralMultiplier ?? 1}x</strong>
                </div>
              </div>

              {/* Card 3: Club Links Signups */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
                <div className="flex justify-between items-center text-xs text-cyan-400 font-bold uppercase tracking-wider">
                  <span>Club Link Signups</span>
                  <span>⚡ Community</span>
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-cyan-300">
                  {kpis?.clubCount ?? 0}
                </div>
                <p className="text-xs text-gray-400">
                  Directly attributed to campus developer clubs and ambassadors.
                </p>
                <div className="text-[11px] text-gray-500 pt-1 border-t border-white/5">
                  Direct organic: <strong className="text-white">{kpis?.directCount ?? 0}</strong>
                </div>
              </div>

              {/* Card 4: Colleges Represented */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
                <div className="flex justify-between items-center text-xs text-amber-400 font-bold uppercase tracking-wider">
                  <span>Campuses Represented</span>
                  <span>🏛️ Reach</span>
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-amber-300">
                  {kpis?.uniqueCollegesCount ?? 0}
                </div>
                <p className="text-xs text-gray-400">
                  Engineering institutions competing on the regional growth board.
                </p>
                <div className="text-[11px] text-gray-500 pt-1 border-t border-white/5">
                  Batch target: <strong className="text-white">6th & 7th Sem BE</strong>
                </div>
              </div>
            </div>

            {/* ── Recharts Chart 1: Registrations Over Time (Line Chart) ───────── */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>📈</span>
                    <span>Registrations Over Time (Timeline)</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Daily registrations and cumulative velocity towards the 500 goal.
                  </p>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 w-fit">
                  Recharts Line Visualization
                </span>
              </div>

              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeline} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis
                      dataKey="day"
                      stroke="#9ca3af"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      fontSize={11}
                      tickLine={false}
                      domain={[0, "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#030712",
                        border: "1px solid #374151",
                        borderRadius: "0.75rem",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      name="Cumulative Total"
                      stroke="#6366f1"
                      strokeWidth={3}
                      dot={{ fill: "#6366f1", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Daily Signups"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      dot={{ fill: "#06b6d4", r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="referral"
                      name="Daily Referrals"
                      stroke="#a855f7"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ fill: "#a855f7", r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Recharts Charts 2 & 3: By College & By Source ─────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart: Registrations by College */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4 shadow-xl">
                <div className="border-b border-white/10 pb-3">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🏛️</span>
                    <span>Registrations by College (Top 10)</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Breakdown of student volume across leading engineering colleges.
                  </p>
                </div>

                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={byCollege}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis type="number" stroke="#9ca3af" fontSize={11} />
                      <YAxis
                        type="category"
                        dataKey="collegeName"
                        stroke="#9ca3af"
                        fontSize={10}
                        tickLine={false}
                        width={110}
                        tickFormatter={(val: string) =>
                          val.length > 16 ? `${val.substring(0, 16)}...` : val
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#030712",
                          border: "1px solid #374151",
                          borderRadius: "0.75rem",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="count" name="Registrations" fill="#6366f1" radius={[0, 6, 6, 0]}>
                        {byCollege.map((_entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              index === 0
                                ? "#f59e0b"
                                : index === 1
                                ? "#cbd5e1"
                                : index === 2
                                ? "#b45309"
                                : "#6366f1"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart: Registrations by Source */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4 shadow-xl">
                <div className="border-b border-white/10 pb-3">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🥧</span>
                    <span>Registrations by Source</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Direct organic vs student squad referrals vs campus club links.
                  </p>
                </div>

                <div className="h-72 w-full pt-2 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={bySource}
                        dataKey="count"
                        nameKey="source"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={5}
                      >
                        {bySource.map((entry, index) => (
                          <Cell
                            key={`source-cell-${index}`}
                            fill={
                              entry.key === "direct"
                                ? "#6366f1"
                                : entry.key === "referral"
                                ? "#a855f7"
                                : "#06b6d4"
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#030712",
                          border: "1px solid #374151",
                          borderRadius: "0.75rem",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* ── Table of Recent Registrations ───────────────────────────────── */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>📋</span>
                    <span>Recent Registrations Table</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Showing {registrations.length} of {totalRegistrationsCount} verified student records.
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-xs w-full">
                  <input
                    type="text"
                    placeholder="Search by name, email, code, college..."
                    value={tableSearch}
                    onChange={(e) => {
                      setTableSearch(e.target.value);
                      setTableOffset(0);
                    }}
                    className="w-full rounded-xl bg-gray-900 border border-white/10 px-3.5 py-2 text-xs sm:text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                  />
                  {tableSearch && (
                    <button
                      onClick={() => setTableSearch("")}
                      className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Table Body */}
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 border-b border-white/10 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">College</th>
                      <th className="py-3 px-4">Cohort</th>
                      <th className="py-3 px-4">Attribution Source</th>
                      <th className="py-3 px-4">Referral Code</th>
                      <th className="py-3 px-4 text-right">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs sm:text-sm">
                    {registrations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs text-gray-500">
                          No registrations found matching your query.
                        </td>
                      </tr>
                    ) : (
                      registrations.map((reg) => (
                        <tr key={reg.id} className="hover:bg-white/[0.02] transition-colors">
                          {/* Name & Email */}
                          <td className="py-3 px-4">
                            <span className="font-semibold text-white block">
                              {reg.name}
                            </span>
                            <span className="text-xs text-gray-400 block font-mono">
                              {reg.email}
                            </span>
                          </td>

                          {/* College */}
                          <td className="py-3 px-4 text-gray-300 font-medium">
                            {reg.collegeName}
                          </td>

                          {/* Semester & Branch */}
                          <td className="py-3 px-4 text-xs text-gray-400">
                            <div>{reg.semester}th Sem BE</div>
                            <div className="text-gray-500 truncate max-w-[160px]">{reg.branch}</div>
                          </td>

                          {/* Attribution Source */}
                          <td className="py-3 px-4">
                            {reg.source === "referral" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                <span>Ref by {reg.referredByName || "Squad"}</span>
                              </span>
                            ) : reg.source === "club_link" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                                <span>Club Link</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-300 border border-white/10">
                                <span>Direct</span>
                              </span>
                            )}
                          </td>

                          {/* Referral Code */}
                          <td className="py-3 px-4">
                            <code className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-indigo-300">
                              {reg.referralCode}
                            </code>
                          </td>

                          {/* Created At */}
                          <td className="py-3 px-4 text-right text-xs text-gray-400 font-mono">
                            {new Date(reg.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalRegistrationsCount > tableLimit && (
                <div className="flex items-center justify-between text-xs text-gray-400 pt-2">
                  <span>
                    Showing {tableOffset + 1}–
                    {Math.min(tableOffset + tableLimit, totalRegistrationsCount)} of{" "}
                    {totalRegistrationsCount}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={tableOffset === 0}
                      onClick={() => setTableOffset(Math.max(0, tableOffset - tableLimit))}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      ← Previous
                    </button>
                    <button
                      disabled={tableOffset + tableLimit >= totalRegistrationsCount}
                      onClick={() => setTableOffset(tableOffset + tableLimit)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
