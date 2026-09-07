import { LoadingRegion, Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function ReportLoading() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <LoadingRegion label="Loading your report">
        <Skeleton className="h-3 w-56" />
        <Skeleton className="mt-4 h-9 w-full" />
        <Skeleton className="mt-2 h-9 w-3/4" />

        <div className="mt-7 flex items-end gap-10 rounded-xl border border-rule bg-paper-raised p-6">
          <div className="flex-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-7 w-40" />
          </div>
          <div>
            <Skeleton className="ml-auto h-3 w-12" />
            <Skeleton className="ml-auto mt-3 h-10 w-14" />
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <Skeleton className="h-3 w-28" />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      </LoadingRegion>
    </div>
  );
}
