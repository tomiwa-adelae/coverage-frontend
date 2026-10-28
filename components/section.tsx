import { cn } from "@/lib/utils"

export function PageSection({
  title,
  count,
  hint,
  children,
  className,
  id,
}: {
  id?: string
  title: string
  count?: number
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section id={id} className={cn("mt-7 scroll-mt-20 first:mt-0", className)}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {title}
        {count !== undefined && (
          <span className="rounded-full border bg-card px-2 text-xs font-medium text-muted-foreground tabular-nums">
            {count}
          </span>
        )}
      </h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </section>
  )
}

export function PageHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </header>
  )
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
      {children}
    </p>
  )
}
