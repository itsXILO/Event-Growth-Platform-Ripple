import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { SearchableCollegeSelect, type College } from "../components/SearchableCollegeSelect";
import { LeaderboardWidget } from "../components/LeaderboardWidget";

interface StatsData {
  total: number;
  goal: number;
  percent: number;
  remaining: number;
  event: {
    id: number;
    slug: string;
    title: string;
  };
}

interface RegistrationSuccess {
  name: string;
  email: string;
  referralCode: string;
  shareLink: string;
}

const DEFAULT_SLUG = "nxtwave-ai-project-in-60-mins";

export function EventLandingPage() {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const slug = routeSlug || DEFAULT_SLUG;

  const [searchParams] = useSearchParams();
  const urlRefCode = searchParams.get("ref") || "";
  const urlClubSlug = searchParams.get("club") || "";

  // Data states
  const [stats, setStats] = useState<StatsData>({
    total: 158,
    goal: 500,
    percent: 32,
    remaining: 342,
    event: { id: 1, slug, title: "Build Your First AI Project in 60 Minutes" },
  });
  const [colleges, setColleges] = useState<College[]>([]);
  const [referrerGreeting, setReferrerGreeting] = useState<{
    name: string;
    collegeName: string;
  } | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [collegeId, setCollegeId] = useState<number | "">("");
  const [semester, setSemester] = useState<number>(6);
  const [branch, setBranch] = useState("Computer Science & Engineering");
  const [customBranch, setCustomBranch] = useState("");
  const [referralCode, setReferralCode] = useState(urlRefCode);

  // Status states
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<RegistrationSuccess | null>(null);
  const [copied, setCopied] = useState(false);

  const registerSectionRef = useRef<HTMLDivElement>(null);
  const leaderboardSectionRef = useRef<HTMLDivElement>(null);

  const BRANCH_OPTIONS = [
    "Computer Science & Engineering",
    "Information Science & Engineering",
    "Artificial Intelligence & Data Science",
    "Electronics & Communication Engineering",
    "Electrical & Electronics Engineering",
    "Mechanical Engineering",
    "Other",
  ];

  // 1. Fetch live stats from /api/events/:slug/stats
  useEffect(() => {
    const fetchStats = () => {
      fetch(`/api/events/${slug}/stats`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.total === "number") {
            setStats(data);
          }
        })
        .catch((err) => console.error("Stats load error:", err));
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000); // 5s polling matching short cache
    return () => clearInterval(interval);
  }, [slug]);

  // 2. Fetch colleges list for dropdown
  useEffect(() => {
    fetch("/api/colleges")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.colleges) setColleges(data.colleges);
      })
      .catch((err) => console.error("Colleges load error:", err));
  }, []);

  // 3. If referral code is provided in URL, lookup referrer info
  useEffect(() => {
    if (urlRefCode) {
      setReferralCode(urlRefCode);
      fetch(`/api/events/${slug}/referral-info?code=${encodeURIComponent(urlRefCode)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.valid && data.referrer) {
            setReferrerGreeting(data.referrer);
          }
        })
        .catch(() => {});
    }
  }, [slug, urlRefCode]);

  const scrollToRegister = () => {
    registerSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToLeaderboard = () => {
    leaderboardSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!collegeId) {
      setErrorMessage("Please select your college from the dropdown.");
      return;
    }

    const selectedBranch = branch === "Other" ? customBranch.trim() : branch;
    if (!selectedBranch) {
      setErrorMessage("Please enter your engineering branch.");
      return;
    }

    setSubmitting(true);

    try {
      const payload: Record<string, string | number> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        collegeId: Number(collegeId),
        semester: Number(semester),
        branch: selectedBranch,
      };

      if (referralCode.trim()) {
        payload.referralCode = referralCode.trim().toUpperCase();
      }

      if (urlClubSlug.trim()) {
        payload.clubSlug = urlClubSlug.trim().toLowerCase();
      }

      const res = await fetch(`/api/events/${slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        if (result.details && Array.isArray(result.details)) {
          setErrorMessage(
            result.details.map((d: { message: string }) => d.message).join(", ")
          );
        } else {
          setErrorMessage(result.error || "Failed to submit registration.");
        }
        setSubmitting(false);
        return;
      }

      const canonicalShareLink = `${window.location.origin}/e/${slug}?ref=${result.referralCode}`;

      // Save college for personalized squad leaderboard tracking
      if (collegeId) {
        localStorage.setItem("ripple_user_college_id", String(collegeId));
      }

      setSuccessData({
        name: result.registration.name,
        email: result.registration.email,
        referralCode: result.referralCode,
        shareLink: canonicalShareLink,
      });

      // Instantly increment live stats locally
      setStats((prev) => ({
        ...prev,
        total: prev.total + 1,
        percent: Math.min(100, Math.round(((prev.total + 1) / prev.goal) * 100)),
        remaining: Math.max(0, prev.remaining - 1),
      }));
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Network error. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = () => {
    if (!successData?.shareLink) return;
    navigator.clipboard.writeText(successData.shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };


  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 pb-20 selection:bg-indigo-500 selection:text-white">
      {/* ── Referral Greeting Banner ────────────────────────────────────────── */}
      {referrerGreeting && (
        <aside aria-label="Referral invitation" className="bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-indigo-950/60 border-b border-indigo-500/30 px-4 py-3 text-center text-xs sm:text-sm text-indigo-200">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
            <span>🎉</span>
            <span>
              You've been invited by <strong className="text-white underline">{referrerGreeting.name}</strong> from{" "}
              <strong className="text-white">{referrerGreeting.collegeName}</strong>. Registering will credit your campus squad!
            </span>
          </div>
        </aside>
      )}

      {/* ── Club Squad Banner ──────────────────────────────────────────────── */}
      {urlClubSlug && !referrerGreeting && (
        <aside aria-label="Club invitation" className="bg-cyan-950/60 border-b border-cyan-500/30 px-4 py-3 text-center text-xs sm:text-sm text-cyan-200">
          <span>🚀 Joining through club invite code: <code className="bg-white/10 px-2 py-0.5 rounded text-white font-mono">{urlClubSlug}</code></span>
        </aside>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 space-y-20">
        {/* ── Hero Section ────────────────────────────────────────────────────── */}
        <section className="text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-xs font-semibold text-indigo-300 shadow-sm">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Free NxtWave Workshop · 6th & 7th Sem BE Cohort</span>
          </div>

          {/* Core Hook Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight max-w-4xl mx-auto">
            Build your first AI project in 60 minutes and{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
              walk away with something you can show recruiters
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-gray-400 leading-relaxed">
            A fast-paced, interactive workshop tailored for 6th and 7th semester BE students. Build, deploy, and represent your college on the live regional growth leaderboard.
          </p>

          {/* Live Counter Widget (Pulls from /api/events/:slug/stats) */}
          <div className="max-w-md mx-auto pt-2 pb-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4 space-y-3 shadow-xl">
              <div className="flex justify-between items-center text-xs font-medium">
                <span className="flex items-center gap-1.5 text-gray-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live Registration Counter</span>
                </span>
                <span className="font-bold text-white">
                  <span className="text-indigo-400 text-sm">{stats.total}</span> / {stats.goal} registered
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(100, Math.max(8, stats.percent))}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[11px] text-gray-400">
                <span>{stats.percent}% filled</span>
                <span className="text-amber-400 font-medium">
                  {stats.remaining > 0 ? `${stats.remaining} spots left before admissions close` : "Waitlist active"}
                </span>
              </div>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={scrollToRegister}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              Claim Your Free Seat Now →
            </button>
            <button
              onClick={scrollToLeaderboard}
              className="w-full sm:w-auto px-6 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>🏆</span>
              <span>View College Leaderboard</span>
            </button>
          </div>
        </section>

        {/* ── What You Will Build Section ─────────────────────────────────────── */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Hands-On Curriculum
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              What You Will Build in 60 Minutes
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 max-w-xl mx-auto">
              Not another passive video tutorial. You code and deploy an interactive AI project from start to finish.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-3 hover:border-indigo-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-2xl">
                🤖
              </div>
              <h3 className="text-lg font-bold text-white">AI Career Copilot</h3>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                Connect LLM APIs to parse tech resumes, compare against real job descriptions, and generate tailored interview questions.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-3 hover:border-indigo-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center text-2xl">
                ⚡
              </div>
              <h3 className="text-lg font-bold text-white">Zero Setup Cloud IDE</h3>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                No local CUDA drivers, Python virtualenvs, or GPU setup required. Write code directly in a browser environment with instant preview.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-3 hover:border-indigo-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center text-2xl">
                🚀
              </div>
              <h3 className="text-lg font-bold text-white">Recruiter-Ready Live Link</h3>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                Deploy to a live public URL on Vercel/Render. Walk away with a portfolio project to put on your resume, LinkedIn, and GitHub.
              </p>
            </div>
          </div>
        </section>

        {/* ── Who It Is For Section ───────────────────────────────────────────── */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Eligibility & Cohort
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              Who It Is For
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 max-w-xl mx-auto">
              Tailored specifically to help engineering undergraduates stand out in placement season.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-3">
              <div className="text-2xl mb-1">🎓</div>
              <h3 className="text-base font-bold text-white">6th & 7th Sem BE Students</h3>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                Facing upcoming campus recruitment drives and technical portfolio screenings who need a standout AI project.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-3">
              <div className="text-2xl mb-1">💻</div>
              <h3 className="text-base font-bold text-white">Prerequisites: Basics Only</h3>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                Basic familiarity with JavaScript or Python. Zero prior AI/ML experience required — all concepts explained step-by-step.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-3">
              <div className="text-2xl mb-1">🏆</div>
              <h3 className="text-base font-bold text-white">Campus Clubs & Ambassadors</h3>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                Developer clubs and campus leaders rallying their batch to put their college at #1 on the regional growth leaderboard.
              </p>
            </div>
          </div>
        </section>

        {/* ── Public Leaderboard Section ───────────────────────────────────────── */}
        <section id="leaderboard" ref={leaderboardSectionRef} className="pt-2 scroll-mt-20">
          <LeaderboardWidget
            slug={slug}
            isEmbedded={true}
            userCollegeId={collegeId ? Number(collegeId) : null}
          />
        </section>

        {/* ── Registration Form Section ───────────────────────────────────────── */}
        <section id="register" ref={registerSectionRef} className="pt-4 scroll-mt-20">
          {successData ? (
            <div className="rounded-3xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/40 via-gray-900 to-gray-950 p-6 sm:p-10 shadow-2xl text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto text-3xl">
                ✓
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  You're Registered, {successData.name}!
                </h2>
                <p className="text-xs sm:text-sm text-gray-300 mt-1">
                  We've reserved your seat for the AI workshop. Share your link to help your college climb the ranks!
                </p>
              </div>

              <div className="max-w-xl mx-auto rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4 text-left">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                    Your Unique Referral Code
                  </span>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-2xl font-mono font-bold tracking-wider text-white">
                      {successData.referralCode}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Active
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Your Referral Squad Link:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={successData.shareLink}
                      className="flex-1 bg-gray-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs sm:text-sm text-gray-200 font-mono select-all focus:outline-none"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {copied ? "Copied! ✓" : "Copy Link"}
                    </button>
                  </div>
                </div>

                {/* Social Share Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Hey! I just registered for the free NxtWave workshop "Build Your First AI Project in 60 Minutes". Use my link to join and help our college climb the live leaderboard! 🚀 ${successData.shareLink}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-gray-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    <span>💬</span>
                    <span>Share on WhatsApp with Squad</span>
                  </a>

                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(
                      successData.shareLink
                    )}&text=${encodeURIComponent(
                      `Join me for the free NxtWave AI Workshop! Build and deploy your first AI project in 60 mins.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Telegram ↗</span>
                  </a>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/leaderboard"
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all text-center"
                >
                  View Live College Leaderboard →
                </Link>
                <button
                  onClick={() => setSuccessData(null)}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer"
                >
                  Register Another Student
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6 sm:p-10 shadow-2xl space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                  <span>🎟️</span>
                  <span>Register for the Free Workshop</span>
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                  100% Free · Verified Certificate · Live 60-Minute Project Build
                </p>
              </div>

              {errorMessage && (
                <div className="rounded-xl bg-red-950/50 border border-red-500/30 p-4 text-xs sm:text-sm text-red-300 flex items-start gap-3">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <p className="font-semibold">Unable to complete registration</p>
                    <p className="text-red-200 mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aarav Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl bg-gray-900 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    College / Personal Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="student@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl bg-gray-900 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Unique constraint applies: 1 registration per email for this workshop.
                  </p>
                </div>

                {/* College Selection (Searchable Dropdown) */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    College / Institution <span className="text-red-400">*</span>
                  </label>
                  <SearchableCollegeSelect
                    colleges={colleges}
                    value={collegeId}
                    onChange={(id) => setCollegeId(id)}
                    disabled={submitting}
                  />
                </div>

                {/* Semester Selection */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Current Semester <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[6, 7, 8].map((sem) => (
                      <button
                        key={sem}
                        type="button"
                        onClick={() => setSemester(sem)}
                        className={`py-3 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer ${
                          semester === sem
                            ? "bg-indigo-600/30 border-indigo-500 text-white shadow-md shadow-indigo-600/20"
                            : "bg-gray-900 border-white/10 text-gray-400 hover:text-white"
                        }`}
                      >
                        {sem}th Sem BE
                      </button>
                    ))}
                  </div>
                </div>

                {/* Engineering Branch */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Engineering Branch <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full rounded-xl bg-gray-900 border border-white/10 px-4 py-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    {BRANCH_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>

                  {branch === "Other" && (
                    <input
                      type="text"
                      required
                      placeholder="Enter branch name..."
                      value={customBranch}
                      onChange={(e) => setCustomBranch(e.target.value)}
                      className="mt-2 w-full rounded-xl bg-gray-900 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    />
                  )}
                </div>

                {/* Referral Code */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Referral Code <span className="text-gray-500">(Optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. REF-XXXXXX"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      className="w-full rounded-xl bg-gray-900 border border-white/10 px-4 py-3 text-sm font-mono text-white placeholder-gray-600 uppercase focus:border-indigo-500 focus:outline-none"
                    />
                    {referralCode && (
                      <span className="absolute right-3 top-3 text-xs text-emerald-400 font-semibold">
                        Applied ✓
                      </span>
                    )}
                  </div>
                </div>

                {/* Submit CTA */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Securing your seat...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Free Registration</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </section>
      </div>

      {/* ── Sticky Mobile Floating Action Bar ──────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-gray-950/95 backdrop-blur-md border-t border-white/10 sm:hidden z-40 flex items-center justify-between gap-3">
        <div className="text-left">
          <span className="text-[11px] font-bold text-indigo-400 block">
            {stats.total} / {stats.goal} Spots
          </span>
          <span className="text-[10px] text-gray-400 block">
            {stats.remaining > 0 ? `${stats.remaining} left` : "Waitlist"}
          </span>
        </div>
        <button
          onClick={scrollToRegister}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 cursor-pointer"
        >
          Register Free →
        </button>
      </div>
    </div>
  );
}
