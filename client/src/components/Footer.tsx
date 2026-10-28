export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-gray-950 py-8 text-center text-xs text-gray-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-300">Ripple</span>
          <span>·</span>
          <span>Event Growth Platform for College Communities</span>
        </div>
        <p className="text-gray-500">
          Built for NxtWave Workshop: "Build Your First AI Project in 60 Minutes"
        </p>
      </div>
    </footer>
  );
}
