/** Ruhiger Ladezustand im Look des Regals. */
export default function Loading() {
  return (
    <div className="flex animate-[fade_0.3s_ease-out_both] flex-col gap-7">
      <div className="flex flex-col gap-3">
        <div className="skeleton h-4 w-40 rounded-full" />
        <div className="skeleton h-9 w-72 rounded-xl" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton h-20 rounded-2xl" />
        ))}
      </div>

      <div className="rounded-3xl border border-ink/8 p-5 dark:border-white/8">
        <div className="skeleton mb-4 h-5 w-36 rounded-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex gap-4">
              <div className="skeleton h-28 w-19 rounded-md" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="skeleton h-3.5 w-full rounded-full" />
                <div className="skeleton h-3 w-2/3 rounded-full" />
                <div className="skeleton mt-6 h-2 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-end gap-3 px-5 pt-8">
          {[190, 220, 170, 205, 235, 180].map((height, index) => (
            <div key={index} className="skeleton w-20 rounded-t-sm" style={{ height }} />
          ))}
        </div>
        <div className="shelf-board h-3 rounded-[3px]" />
      </div>
    </div>
  );
}
