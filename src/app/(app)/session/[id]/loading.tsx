import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

export default function SessionLoading() {
  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <LoadingRegion label="Opening the negotiation">
        <div className="border-b border-rule bg-paper-sunken">
          <div className="mx-auto flex max-w-3xl items-center gap-5 px-5 py-3 sm:px-8">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="mt-2 h-3.5 w-44" />
            </div>
            <div className="text-right">
              <Skeleton className="ml-auto h-3 w-20" />
              <Skeleton className="ml-auto mt-2 h-4 w-24" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
          <Skeleton className="mx-auto h-3 w-64" />
          <div className="mt-8 space-y-6">
            {/* Alternating widths so it reads as a conversation rather than a list. */}
            {[92, 64, 88].map((w, i) => (
              <div key={i}>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-2 h-20 rounded-xl" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        </div>
      </LoadingRegion>
    </div>
  );
}
