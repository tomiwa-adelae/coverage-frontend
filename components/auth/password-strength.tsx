import { IconCheck, IconCircle } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

const RULES: [string, (p: string) => boolean][] = [
  ["8+ characters", (p) => p.length >= 8],
  ["A letter", (p) => /[A-Za-z]/.test(p)],
  ["A number", (p) => /\d/.test(p)],
  [
    "A symbol or 12+ characters",
    (p) => /[^A-Za-z0-9]/.test(p) || p.length >= 12,
  ],
]

const LEVELS = ["Too weak", "Weak", "Fair", "Good", "Strong"]
const COLORS = [
  "bg-destructive",
  "bg-destructive",
  "bg-warning",
  "bg-tier-b",
  "bg-emerald-500",
]

/** Live checklist and meter under a new-password field. */
export function PasswordStrength({ password }: { password: string }) {
  const passed = RULES.map(([, test]) => test(password))
  const score = passed.filter(Boolean).length
  return (
    <div className="grid gap-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full bg-muted transition-colors",
                password && i < score && COLORS[score]
              )}
            />
          ))}
        </div>
        <span className="w-14 text-right text-xs text-muted-foreground">
          {password ? LEVELS[score] : ""}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {RULES.map(([label], i) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-1.5 text-xs text-muted-foreground transition-colors",
              passed[i] && "text-foreground"
            )}
          >
            {passed[i] ? (
              <IconCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <IconCircle className="size-3" />
            )}
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}
