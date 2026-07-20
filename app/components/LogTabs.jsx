"use client";

export default function LogTabs({ active, onChange }) {
  const tabs = [
    { key: "daily", label: "Daily Log" },
    { key: "monthly", label: "Monthly Log" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 border-t border-white/10">
      <div className="flex gap-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`py-3 text-sm font-medium border-b-2 transition ${
              active === tab.key
                ? "border-[#F97316] text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}