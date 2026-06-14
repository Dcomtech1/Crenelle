import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsLoading() {
  return (
    <div className="max-w-2xl space-y-6 animate-pulse">
      <div className="border-b border-border pb-8 mb-10">
        <Skeleton className="h-10 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="border border-border bg-card p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-1 h-4 bg-copper shrink-0 animate-pulse" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
          <Skeleton className="h-12 w-32 mt-4" />
        </div>
      </div>
    </div>
  )
}
