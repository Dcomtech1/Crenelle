import { Globe } from "lucide-react"
import { cn } from "@/lib/utils"

interface EventCardProps {
  name: string
  date: string
  time: string
  guestCount: number
  capacity: number
  status: "OPEN" | "CLOSED" | "LIVE" | "PUBLISHED" | "DRAFT"
  eventType?: "closed" | "open"
  onStatusClick?: (e: React.MouseEvent) => void
  className?: string
  guestLabel?: string
}

export function EventCard({
  name,
  date,
  time,
  guestCount,
  capacity,
  status,
  eventType = 'closed',
  onStatusClick,
  className,
  guestLabel,
}: EventCardProps) {
  const percentage = Math.min((guestCount / capacity) * 100, 100)

  const statusConfig: Record<string, { cls: string; label: string }> = {
    LIVE:      { cls: "status-live",      label: "Live" },
    PUBLISHED: { cls: "status-published", label: "Published" },
    DRAFT:     { cls: "status-draft",     label: "Draft" },
    OPEN:      { cls: "status-open",      label: "Open" },
    CLOSED:    { cls: "status-ended",     label: "Closed" },
  }

  const { cls, label } = statusConfig[status] ?? statusConfig.DRAFT
  const manifestNum = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 9000 + 1000

  return (
    <div className={cn(
      "relative w-full bg-card border border-border overflow-hidden flex hover:border-copper/40 transition-colors duration-200 group",
      className
    )}>
      {/* Copper left accent */}
      <div className="w-1 shrink-0 bg-copper opacity-60 group-hover:opacity-100 transition-opacity" />

      {/* Ticket body */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top: identity */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-4">
            {/* Name + meta — takes all space EXCEPT status */}
            <div className="flex-1 min-w-0 pr-2">
              <h2
                className="font-display font-semibold leading-tight text-foreground truncate"
                style={{ fontSize: 'clamp(20px, 2.5vw, 28px)' }}
              >
                {name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="font-sans text-[10px] uppercase tracking-[0.15em] text-muted-foreground border border-border px-2 py-0.5">
                  #{manifestNum}
                </span>
                <span className="font-sans text-[10px] text-muted-foreground">
                  {date} {time && `· ${time}`}
                </span>
                {eventType === 'open' && (
                  <span className="flex items-center gap-1 font-sans text-[9px] uppercase tracking-widest text-copper border border-copper/30 px-2 py-0.5">
                    <Globe className="h-2.5 w-2.5" />
                    Open
                  </span>
                )}
              </div>
            </div>

            {/* Status badge — clickable if handler provided, positioned safely away from delete button */}
            {onStatusClick ? (
              <button
                onClick={onStatusClick}
                className={cn(
                  "shrink-0 mt-0.5 cursor-pointer hover:opacity-75 transition-opacity",
                  cls
                )}
                title="Click to change status"
                aria-label={`Status: ${label} — click to change`}
              >
                {label}
              </button>
            ) : (
              <span className={cn("shrink-0 mt-0.5", cls)}>{label}</span>
            )}
          </div>
        </div>

        {/* Perforated divider */}
        <div className="relative mx-4">
          <div className="border-t border-dashed border-border" />
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-background" />
          <div className="absolute -right-6 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-background" />
        </div>

        {/* Bottom: metrics */}
        <div className="px-5 py-4 flex items-center gap-8">
          <div>
            <p className="font-sans text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
              {guestLabel || "Guests"}
            </p>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-2xl font-semibold text-foreground leading-none">
                {guestCount.toString().padStart(3, '0')}
              </span>
              <span className="font-sans text-xs text-muted-foreground">/ {capacity}</span>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex justify-between mb-1.5">
              <p className="font-sans text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Capacity</p>
              <p className="font-sans text-[9px] text-muted-foreground">{Math.round(percentage)}%</p>
            </div>
            <div className="w-full h-1 bg-muted">
              <div
                className="h-full bg-copper transition-all duration-700"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Fine print */}
        <div className="px-5 py-2 border-t border-border flex justify-between">
          <span className="font-sans text-[8px] uppercase tracking-[0.15em] text-muted-foreground/40">
            Crenelle · Entry System
          </span>
          <span className="font-sans text-[8px] uppercase tracking-[0.15em] text-muted-foreground/40">
            Encrypted
          </span>
        </div>
      </div>
    </div>
  )
}
