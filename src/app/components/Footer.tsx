const DISCLAIMER =
  "This diagnostic tool performs a read-only assessment of your laptop and does not make any changes to hardware, software, files, or system configurations.";

// Persistent disclaimer bar, rendered once at the app root (see App.tsx) so it
// stays visible on every screen for the lifetime of the app. The text starts
// visible at the right edge and scrolls continuously to the left, looping
// indefinitely, via a plain CSS keyframe animation scoped to this component
// (no dependency on the global stylesheet chain).
export function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-[100] h-8 bg-[#0B2545] border-t border-[#123a63] overflow-hidden flex items-center justify-end shadow-[0_-1px_4px_rgba(0,0,0,0.15)]">
      <style>{`
        @keyframes pulse-disclaimer-marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-100vw); }
        }
      `}</style>
      <div
        className="whitespace-nowrap text-[11px] font-bold text-slate-200 tracking-wide"
        style={{
          animation: "pulse-disclaimer-marquee 26s linear infinite",
        }}
      >
        {DISCLAIMER}
      </div>
    </footer>
  );
}
