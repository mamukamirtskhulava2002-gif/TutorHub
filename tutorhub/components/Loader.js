// სხვადასხვა სახის loader — page, spinner, skeleton, dots

// ─── სრული გვერდის loader ───
export function PageLoader({ text = "იტვირთება..." }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}

// ─── Spinner ───
export function Spinner({ size = "md", color = "emerald" }) {
  const sizes = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-10 h-10" };
  const colors = {
    emerald: "border-emerald-600",
    gray:    "border-gray-400",
    white:   "border-white",
  };
  return (
    <div
      className={`${sizes[size]} rounded-full border-2 border-t-transparent animate-spin ${colors[color]}`}
      role="status"
      aria-label="იტვირთება"
    />
  );
}

// ─── Skeleton ბარათი (tutor card) ───
export function TutorCardSkeleton({ count = 6 }) {
  return (
    <>
      {Array(count).fill(0).map((_, i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="flex gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
            <div className="flex-1">
              <div className="h-3.5 bg-gray-200 rounded w-2/3 mb-1.5" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
          <div className="flex gap-1.5 mb-3">
            <div className="h-5 bg-gray-200 rounded-full w-16" />
            <div className="h-5 bg-gray-200 rounded-full w-14" />
          </div>
          <div className="flex justify-between">
            <div className="h-3 bg-gray-200 rounded w-20" />
            <div className="h-3 bg-gray-200 rounded w-12" />
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Skeleton სტატ ბარათი ───
export function StatCardSkeleton({ count = 4 }) {
  return (
    <>
      {Array(count).fill(0).map((_, i) => (
        <div key={i} className="stat-card animate-pulse">
          <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
          <div className="h-7 bg-gray-200 rounded w-1/2 mb-1" />
          <div className="h-3 bg-gray-200 rounded w-1/3" />
        </div>
      ))}
    </>
  );
}

// ─── Skeleton სიაში ───
export function ListSkeleton({ count = 5 }) {
  return (
    <div className="space-y-3">
      {Array(count).fill(0).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl animate-pulse">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="flex-1">
            <div className="h-3.5 bg-gray-200 rounded w-1/3 mb-1.5" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
          <div className="h-5 bg-gray-200 rounded-full w-16" />
        </div>
      ))}
    </div>
  );
}

// ─── Typing dots (ჩათისთვის) ───
export function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// ─── Default export ───
export default Spinner;