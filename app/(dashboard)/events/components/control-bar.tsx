import { cn } from "@/lib/utils"

interface ControlBarProps {
  filter: string
  setFilter: (filter: string) => void
  sortBy: "updated" | "created" | "name"
  setSortBy: (sort: "updated" | "created" | "name") => void
}

export function ControlBar({ filter, setFilter, sortBy, setSortBy }: ControlBarProps) {
  const filters = [
    { id: "all",       label: "All" },
    { id: "active",    label: "Live" },
    { id: "published", label: "Published" },
    { id: "draft",     label: "Draft" },
    { id: "closed",    label: "Ended" },
  ]

  return (
    <div className="flex flex-col sm:flex-row gap-5 mb-8 pb-6 border-b border-border">
      {/* Status filter pills */}
      <div className="flex flex-col gap-2 flex-1">
        <span className="font-sans text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          Filter
        </span>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => {
            const isActive = filter === f.id
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] border transition-all",
                  isActive
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Sort select */}
      <div className="flex flex-col gap-2 min-w-[160px]">
        <span className="font-sans text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          Sort by
        </span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "updated" | "created" | "name")}
          className="bg-muted border border-border px-3 py-1.5 font-sans text-[11px] uppercase tracking-[0.12em] text-foreground focus:outline-none focus:border-copper appearance-none cursor-pointer h-9"
          style={{
            backgroundImage:
              "linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%)",
            backgroundPosition: "calc(100% - 14px) center, calc(100% - 9px) center",
            backgroundSize: "4px 4px, 4px 4px",
            backgroundRepeat: "no-repeat",
          }}
        >
          <option value="updated">Last updated</option>
          <option value="created">Date created</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>
    </div>
  )
}
