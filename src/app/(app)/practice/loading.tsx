import { LoadingRegion, Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function PracticeLoading() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <LoadingRegion label="Loading scenarios">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-px w-4" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-px w-4" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="mt-8 h-10 w-2/3 max-w-md" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
      </LoadingRegion>
    </div>
  );
}
