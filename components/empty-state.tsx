import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'relative border-2 border-foreground/10 bg-secondary/5 py-16 px-6 flex flex-col items-center justify-center text-center overflow-hidden min-h-[350px] group/empty',
        className
      )}
    >
      {/* Visual background pattern */}
      <div 
        className="absolute inset-0 bg-[radial-gradient(rgba(120,120,120,0.12)_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" 
      />

      {icon && (
        <div className="w-16 h-16 border-2 border-copper/30 flex items-center justify-center bg-background text-copper mb-6 shrink-0 relative transition-colors duration-300 group-hover/empty:border-copper/60 group-hover/empty:text-copper shadow-[3px_3px_0px_rgba(184,134,11,0.1)] group-hover/empty:shadow-[3px_3px_0px_rgba(184,134,11,0.2)]">
          {/* Corner accents */}
          <div className="absolute -top-1 -left-1 w-1.5 h-1.5 bg-copper" />
          <div className="absolute -bottom-1 -right-1 w-1.5 h-1.5 bg-copper" />
          <div className="w-8 h-8 flex items-center justify-center">
            {icon}
          </div>
        </div>
      )}

      <h3 className="font-display text-2xl uppercase tracking-wider text-foreground mb-2 relative font-semibold">
        {title}
      </h3>

      {subtitle && (
        <p className="font-mono text-[10px] text-foreground/50 uppercase tracking-widest max-w-sm leading-relaxed relative">
          {subtitle}
        </p>
      )}

      {action && <div className="mt-8 relative z-10">{action}</div>}
    </div>
  )
}
