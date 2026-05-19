import { Users, UserCheck, Clock, BarChart3 } from 'lucide-react'

interface StatsPanelProps {
  stats: {
    totalGuests: number
    checkedIn: number
    totalCapacity: number
  }
  remaining: number
  capacityPercent: number
}

export function StatsPanel({ stats, remaining, capacityPercent }: StatsPanelProps) {
  const statItems = [
    { label: "Total guests",   value: stats.totalGuests,               icon: <Users className="size-4" /> },
    { label: "Checked in",     value: stats.checkedIn,                 icon: <UserCheck className="size-4" /> },
    { label: "Remaining",      value: remaining,                       icon: <Clock className="size-4" /> },
    { label: "Capacity used",  value: `${capacityPercent.toFixed(1)}%`, icon: <BarChart3 className="size-4" /> },
  ]

  return (
    <div className="bg-card border border-border p-7 sticky top-24">
      <header className="flex items-center gap-3 mb-8 pb-5 border-b border-border">
        <div className="w-1.5 h-1.5 rounded-full bg-copper animate-blink" />
        <h3 className="font-display text-xl font-semibold text-foreground tracking-tight">Live overview</h3>
        <span className="ml-auto font-sans text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Real-time</span>
      </header>

      <div className="flex flex-col divide-y divide-border">
        {statItems.map((stat) => (
          <div key={stat.label} className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2.5 text-muted-foreground">
              {stat.icon}
              <span className="font-sans text-xs uppercase tracking-[0.15em]">{stat.label}</span>
            </div>
            <span className="font-display text-3xl font-semibold text-foreground leading-none">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-5 border-t border-border">
        <div className="flex justify-between items-center mb-2">
          <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Global capacity</span>
          <span className="font-sans text-xs font-semibold text-copper">{capacityPercent.toFixed(0)}%</span>
        </div>
        <div className="w-full h-1.5 bg-muted">
          <div
            className="h-full bg-copper transition-all duration-1000 ease-out"
            style={{ width: `${capacityPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-5 p-4 bg-muted/50 border border-border">
        <p className="font-sans text-[10px] text-muted-foreground leading-relaxed">
          All data aggregated across active events. Scanner connections are encrypted.
        </p>
      </div>
    </div>
  )
}
