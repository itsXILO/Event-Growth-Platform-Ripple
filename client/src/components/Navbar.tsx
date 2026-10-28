import { Link, useLocation } from "react-router-dom";

export function Navbar() {
  const location = useLocation();

  const navItems = [
    { label: "Workshop & Register", path: "/" },
    { label: "Live Leaderboard", path: "/leaderboard" },
    { label: "Admin Analytics", path: "/admin" },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-gray-950/80 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold tracking-tight text-white">Ripple</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                NxtWave AI
              </span>
            </div>
            <p className="text-[11px] text-gray-400 leading-none">Event Growth Platform</p>
          </div>
        </Link>

        {/* Navigation links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/10 text-white shadow-inner"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Live CTA Button */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/leaderboard"
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-900/40 transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            Live Rankings
          </Link>
        </div>
      </div>
    </header>
  );
}
