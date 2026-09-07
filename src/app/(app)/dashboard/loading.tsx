import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <LoadingRegion label="Loading your progress">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-10 w-3/5 max-w-sm" />

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-rule bg-paper-raised p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-8 w-16" />
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-rule bg-paper-raised p-5 sm:p-6">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>

        <Skeleton className="mt-10 h-3 w-16" />
        <div className="mt-4 overflow-hidden rounded-xl border border-rule">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 bg-paper-raised px-4 py-4 sm:px-5 ${i > 0 ? "border-t border-rule" : ""}`}
            >
              <div className="flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-56" />
              </div>
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>
      </LoadingRegion>
    </div>
  );
}
