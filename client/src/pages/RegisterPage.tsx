import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";

interface College {
  id: number;
  name: string;
}

interface EventData {
  id: number;
  slug: string;
  title: string;
  description: string;
  startsAt: string;
  capacity: number;
  totalRegistrations: number;
}

interface RegistrationSuccess {
  name: string;
  email: string;
  referralCode: string;
  shareLink: string;
}

const EVENT_SLUG = "nxtwave-ai-project-in-60-mins";

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const urlRefCode = searchParams.get("ref") || "";
  const urlClubId = searchParams.get("club") || "";

  // Data states
  const [colleges, setColleges] = useState<College[]>([]);
  const [event, setEvent] = useState<EventData | null>(null);
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

  const BRANCH_OPTIONS = [
    "Computer Science & Engineering",
    "Information Science & Engineering",
    "Artificial Intelligence & Data Science",
    "Electronics & Communication Engineering",
    "Electrical & Electronics Engineering",
    "Mechanical Engineering",
    "Other",
  ];

  // Fetch initial event info & colleges list
  useEffect(() => {
    fetch(`/api/events/${EVENT_SLUG}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.event) setEvent(data.event);
      })
      .catch((err) => console.error("Failed to load event:", err));

    fetch("/api/colleges")
      .then((res) => res.json())
      .then((data) => {
        if (data.colleges) setColleges(data.colleges);
      })
      .catch((err) => console.error("Failed to load colleges:", err));
  }, []);

  // If referral code is in URL, fetch referrer details to warmly greet registrant
  useEffect(() => {
    if (urlRefCode) {
      setReferralCode(urlRefCode);
      fetch(`/api/events/${EVENT_SLUG}/referral-info?code=${encodeURIComponent(urlRefCode)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.valid && data.referrer) {
            setReferrerGreeting(data.referrer);
          }
        })
        .catch(() => {});
    }
  }, [urlRefCode]);

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

      if (urlClubId) {
        payload.clubId = Number(urlClubId);
      }

      const res = await fetch(`/api/events/${EVENT_SLUG}/register`, {
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

      setSuccessData({
        name: result.registration.name,
        email: result.registration.email,
        referralCode: result.referralCode,
        shareLink: result.shareLink,
      });

      // Increment live count locally
      if (event) {
        setEvent({
          ...event,
          totalRegistrations: event.totalRegistrations + 1,
        });
      }
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

  const shareText = encodeURIComponent(
    `Hey! I just registered for the free NxtWave workshop "Build Your First AI Project in 60 Minutes". Join using my link and help our college climb the live leaderboard! 🚀`
  );

  const capacity = event?.capacity || 1000;
  const currentCount = event?.totalRegistrations || 156;
  const percentFilled = Math.min(100, Math.round((currentCount / capacity) * 100));

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Referral Greeting Banner */}
        {referrerGreeting && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-indigo-950/40 border border-indigo-500/30 p-4 sm:p-5 shadow-lg shadow-indigo-950/50">
            <div className="flex items-start sm:items-center gap-3">
              <span className="text-2xl">🎉</span>
              <div>
                <p className="text-sm font-semibold text-indigo-300">
                  You've been invited by <span className="text-white underline">{referrerGreeting.name}</span>
                </p>
                <p className="text-xs text-indigo-200/80 mt-0.5">
                  Representing <span className="font-medium text-white">{referrerGreeting.collegeName}</span>. Your registration will credit your campus squad on the live leaderboard!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400">
            <span>✨</span>
            <span>Free Hands-on Workshop for 6th & 7th Sem BE Students</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Build Your First AI Project <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
              in 60 Minutes
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-gray-400">
            Join thousands of engineering students competing to put their college at the top. Learn core AI concepts, build a production-ready application, and get your personalized referral squad link.
          </p>

          {/* Registration Capacity Progress Bar */}
          <div className="max-w-md mx-auto pt-2">
            <div className="flex justify-between items-center text-xs font-medium text-gray-400 mb-1.5">
              <span>Live Attendance Counter</span>
              <span className="text-indigo-400 font-semibold">
                {currentCount} / {capacity} spots filled ({percentFilled}%)
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500"
                style={{ width: `${percentFilled}%` }}
              />
            </div>
          </div>
        </div>

        {/* Value Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
            <div className="text-xl mb-1">⚡</div>
            <h3 className="text-sm font-semibold text-white">Build & Deploy</h3>
            <p className="text-xs text-gray-400 mt-1">Hands-on coding with live mentor guidance in 60 mins.</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
            <div className="text-xl mb-1">🏆</div>
            <h3 className="text-sm font-semibold text-white">Campus Rivalry</h3>
            <p className="text-xs text-gray-400 mt-1">Live leaderboard tracks which college brings the most devs.</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
            <div className="text-xl mb-1">🔗</div>
            <h3 className="text-sm font-semibold text-white">Unique Referral Squad</h3>
            <p className="text-xs text-gray-400 mt-1">Get your personalized link immediately upon registering.</p>
          </div>
        </div>

        {/* Registration Form / Success State */}
        {successData ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/40 via-gray-900 to-gray-950 p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto text-3xl">
              ✓
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white">You're Registered, {successData.name}!</h2>
              <p className="text-sm text-gray-300 mt-1">
                A confirmation has been logged for <span className="font-semibold text-emerald-300">{successData.email}</span>.
              </p>
            </div>

            {/* Referral Share Box */}
            <div className="max-w-xl mx-auto rounded-xl bg-white/5 border border-white/10 p-5 space-y-4">
              <div className="text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  Your Unique Referral Code
                </span>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-2xl font-mono font-bold tracking-wider text-white">
                    {successData.referralCode}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Active & Ready
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-left text-xs font-medium text-gray-400 mb-1">
                  Share Your Link to Boost Your College's Rank:
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
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {copied ? "Copied! ✓" : "Copy Link"}
                  </button>
                </div>
              </div>

              {/* Instant Share Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <a
                  href={`https://wa.me/?text=${shareText}%20${encodeURIComponent(successData.shareLink)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                >
                  <span>Share on WhatsApp</span>
                </a>
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(successData.shareLink)}&text=${shareText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-sky-600/90 hover:bg-sky-500 text-white text-xs font-medium transition-colors"
                >
                  <span>Telegram</span>
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(successData.shareLink)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-700/90 hover:bg-blue-600 text-white text-xs font-medium transition-colors"
                >
                  <span>LinkedIn</span>
                </a>
              </div>
            </div>

            {/* Check Leaderboard CTA */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/leaderboard"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all text-center"
              >
                View Live College Leaderboard →
              </Link>
              <button
                onClick={() => setSuccessData(null)}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-sm font-medium transition-colors"
              >
                Register Another Student
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6 sm:p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span>🎟️</span>
              <span>Claim Your Free Spot</span>
            </h2>

            {errorMessage && (
              <div className="mb-6 rounded-xl bg-red-950/50 border border-red-500/30 p-4 text-sm text-red-300 flex items-start gap-3">
                <span className="text-lg">⚠️</span>
                <div>
                  <p className="font-semibold">Registration notice</p>
                  <p className="text-xs text-red-200 mt-0.5">{errorMessage}</p>
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
                  className="w-full rounded-xl bg-gray-900/90 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  College / Primary Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. student@college.edu or name@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl bg-gray-900/90 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Unique constraint applies: 1 registration per email for this workshop.
                </p>
              </div>

              {/* College Dropdown */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  College / University <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={collegeId}
                  onChange={(e) => setCollegeId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full rounded-xl bg-gray-900/90 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors"
                >
                  <option value="">Select your college...</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester (6th, 7th, 8th sem BE) */}
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
                      className={`py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                        semester === sem
                          ? "bg-indigo-600/30 border-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                          : "bg-gray-900/50 border-white/10 text-gray-400 hover:text-gray-200 hover:bg-gray-900"
                      }`}
                    >
                      {sem}th Semester
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
                  className="w-full rounded-xl bg-gray-900/90 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors"
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
                    placeholder="Enter your branch name..."
                    value={customBranch}
                    onChange={(e) => setCustomBranch(e.target.value)}
                    className="mt-2 w-full rounded-xl bg-gray-900/90 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors"
                  />
                )}
              </div>

              {/* Referral Code (Optional / Pre-filled) */}
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
                    className="w-full rounded-xl bg-gray-900/90 border border-white/10 px-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 uppercase focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors"
                  />
                  {referralCode && (
                    <span className="absolute right-3 top-2.5 text-xs text-emerald-400 font-medium">
                      Applied ✓
                    </span>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-4 py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing registration...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Registration & Get Squad Link</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
