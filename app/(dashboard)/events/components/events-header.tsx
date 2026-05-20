import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface EventsHeaderProps {
  isSearchExpanded: boolean
  setIsSearchExpanded: (expanded: boolean) => void
  search: string
  setSearch: (search: string) => void
}

export function EventsHeader({
  isSearchExpanded,
  setIsSearchExpanded,
  search,
  setSearch
}: EventsHeaderProps) {
  return (
    <header className="flex items-center justify-between mb-2 min-h-[48px]">
      <div
        className={cn(
          "flex items-center gap-4 flex-1 transition-opacity duration-300",
          isSearchExpanded && "hidden md:flex"
        )}
      >
        <h2 className="font-display text-2xl font-semibold text-foreground shrink-0 tracking-tight">
          Events
        </h2>
        <div className="flex-1 border-t border-border" />
      </div>

      <div
        className={cn(
          "flex items-center transition-all duration-300 ease-in-out",
          isSearchExpanded ? "w-full md:w-80 ml-0 md:ml-4" : "w-10"
        )}
      >
        {isSearchExpanded ? (
          <div className="relative w-full">
            <input
              autoFocus
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => !search && setIsSearchExpanded(false)}
              className="w-full bg-muted border border-border px-4 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-copper transition-colors"
            />
            <button
              onClick={() => { setIsSearchExpanded(false); setSearch("") }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsSearchExpanded(true)}
            className="p-2 border border-transparent hover:border-border hover:bg-foreground/4 text-muted-foreground hover:text-foreground transition-all ml-auto"
            aria-label="Search events"
          >
            <Search className="size-4" />
          </button>
        )}
      </div>
    </header>
  )
}
