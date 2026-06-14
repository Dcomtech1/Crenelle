import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6 pb-8 border-b border-border">
        <div>
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-4 w-40 mt-2" />
        </div>
        <Skeleton className="h-12 w-36 shrink-0" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Events list skeleton */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Header row skeleton */}
          <div className="flex justify-between items-center mb-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-8" />
          </div>

          {/* Control Bar skeleton */}
          <div className="flex flex-wrap gap-3 items-center justify-between border-y-2 border-foreground/10 py-4">
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>

          {/* Cards stack skeleton */}
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border p-5 flex flex-col gap-4 bg-card">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-7 w-3/4" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
                <div className="border-t border-dashed border-border my-1" />
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Panel skeleton */}
        <div className="lg:col-span-5 space-y-8">
          <div>
            <Skeleton className="h-7 w-40 mb-4" />
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="border border-border p-5 space-y-3 bg-card">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-12" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border p-5 space-y-3 bg-card">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
