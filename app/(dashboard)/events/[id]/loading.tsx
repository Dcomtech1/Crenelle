import { Skeleton } from "@/components/ui/skeleton"

export default function EventDetailLoading() {
  return (
    <div className="max-w-6xl w-full mx-auto space-y-6 animate-pulse mt-6">
      {/* Content area header skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-6 border-b border-border">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-48" />
        </div>
        <Skeleton className="h-10 w-32 shrink-0" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main section */}
        <div className="lg:col-span-8 space-y-6">
          <div className="border border-border p-6 space-y-6 bg-card">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-4 items-center">
                <Skeleton className="h-4 w-24 shrink-0" />
                <Skeleton className="h-6 flex-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar section */}
        <div className="lg:col-span-4 space-y-6">
          <div className="border border-border p-5 space-y-4 bg-card">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
