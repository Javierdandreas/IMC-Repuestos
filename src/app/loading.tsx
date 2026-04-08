export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1500px] bg-white p-6 animate-in fade-in duration-500">
      {/* Header Skeleton */}
      <div className="mb-6 flex flex-col gap-4 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="h-10 w-48 rounded-xl bg-slate-100 animate-pulse" />
        <div className="h-11 w-40 rounded-xl bg-slate-100 animate-pulse" />
      </div>

      {/* Filters Skeleton */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
              <div className="h-11 w-full rounded-xl bg-slate-50 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between border-t border-slate-50 pt-3">
          <div className="h-4 w-32 rounded bg-slate-50 animate-pulse" />
          <div className="h-10 w-32 rounded-xl bg-slate-50 animate-pulse" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 p-4">
          <div className="flex gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-3 w-full rounded bg-slate-200 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-slate-100 p-4 space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-4 pb-4">
              {[...Array(8)].map((_, j) => (
                <div key={j} className="h-4 w-full rounded bg-slate-50 animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
