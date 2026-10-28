import { useEffect, useState } from "react";

interface HealthData {
  status: string;
  uptime: number;
  timestamp: string;
  env: string;
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
        ok
          ? "bg-emerald-900/50 text-emerald-400 ring-1 ring-emerald-500/30"
          : "bg-red-900/50 text-red-400 ring-1 ring-red-500/30"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`}
      />
      {ok ? "API online" : "API offline"}
    </span>
  );
}

export default function App() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? "";
    fetch(`${apiUrl}/health`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<HealthData>;
      })
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Unknown error");
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Logo / Title */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-500/30">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Ripple
        </h1>
        <p className="mt-1 text-gray-400 text-sm">
          Event Growth Platform · dev dashboard
        </p>
      </div>

      {/* Health Card */}
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            Server Health
          </h2>
          {loading ? (
            <span className="text-xs text-gray-500">checking…</span>
          ) : (
            <StatusBadge ok={!error} />
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {health && !loading && (
          <dl className="space-y-3 text-sm">
            {(
              [
                ["Status", health.status],
                ["Uptime", `${health.uptime}s`],
                ["Environment", health.env],
                [
                  "Timestamp",
                  new Date(health.timestamp).toLocaleTimeString(),
                ],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0"
              >
                <dt className="text-gray-400">{label}</dt>
                <dd className="font-medium text-white">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <p className="mt-8 text-xs text-gray-600">
        GET /health · localhost:4000
      </p>
    </div>
  );
}
