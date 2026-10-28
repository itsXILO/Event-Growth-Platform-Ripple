import { useState, useRef, useEffect } from "react";

export interface College {
  id: number;
  name: string;
}

interface SearchableCollegeSelectProps {
  colleges: College[];
  value: number | "";
  onChange: (collegeId: number) => void;
  disabled?: boolean;
}

export function SearchableCollegeSelect({
  colleges,
  value,
  onChange,
  disabled = false,
}: SearchableCollegeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedCollege = colleges.find((c) => c.id === value);

  // Filter colleges based on user query
  const filteredColleges = colleges.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (college: College) => {
    onChange(college.id);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Selected Box / Search Input */}
      <div
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        className={`w-full rounded-xl bg-gray-900 border px-4 py-3 text-sm flex items-center justify-between cursor-pointer transition-colors ${
          isOpen
            ? "border-indigo-500 ring-1 ring-indigo-500"
            : "border-white/10 hover:border-white/20"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div className="flex-1 truncate">
          {selectedCollege ? (
            <span className="text-white font-medium">{selectedCollege.name}</span>
          ) : (
            <span className="text-gray-500">Search & select your college...</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 pl-2 text-gray-400">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("" as unknown as number);
              }}
              className="hover:text-white p-0.5 text-xs rounded"
            >
              ✕
            </button>
          )}
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-indigo-400" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-2 rounded-2xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-fadeIn">
          {/* Search Box Inside Dropdown */}
          <div className="p-2.5 border-b border-white/10 bg-white/[0.02]">
            <div className="relative">
              <svg
                className="w-4 h-4 absolute left-3 top-3 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                autoFocus
                placeholder="Type college name (e.g. RVCE, PES, BMS)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-gray-950 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* List of Colleges */}
          <div className="max-h-60 overflow-y-auto divide-y divide-white/5 p-1">
            {filteredColleges.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-gray-500">
                No matching college found for "{query}".
              </div>
            ) : (
              filteredColleges.map((college) => {
                const isSelected = college.id === value;
                return (
                  <div
                    key={college.id}
                    onClick={() => handleSelect(college)}
                    className={`px-3 py-2.5 rounded-lg text-xs sm:text-sm cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected
                        ? "bg-indigo-600/30 text-indigo-200 font-semibold"
                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span>{college.name}</span>
                    {isSelected && <span className="text-indigo-400">✓</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
