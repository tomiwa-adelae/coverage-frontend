import { cn } from "@/lib/utils"
import { initials } from "@/lib/format"
import type { Tier } from "@/lib/types"

const TIER_STYLE: Record<Tier, string> = {
  A: "bg-tier-a/15 text-tier-a ring-tier-a/40",
  B: "bg-tier-b/12 text-tier-b ring-tier-b/35",
  C: "bg-tier-c/12 text-tier-c ring-tier-c/35",
}

/** Initials in a tier-coloured circle, with the tier letter as a corner badge. */
export function ProspectAvatar({
  name,
  tier,
  size = "md",
  className,
}: {
  name: string
  tier: Tier | null
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full font-semibold ring-1",
        size === "sm" && "size-7 text-[11px]",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-14 text-lg",
        tier ? TIER_STYLE[tier] : "bg-muted text-muted-foreground ring-border",
        className
      )}
      aria-hidden
    >
      {initials(name)}
      {size !== "sm" && (
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 grid place-items-center rounded-full border-2 border-card font-bold",
            size === "md" ? "size-[18px] text-[9px]" : "size-6 text-[11px]",
            tier === "A" && "bg-tier-a text-white",
            tier === "B" && "bg-tier-b text-white",
            tier === "C" && "bg-tier-c text-white",
            !tier && "bg-muted text-muted-foreground"
          )}
        >
          {tier ?? "?"}
        </span>
      )}
    </span>
  )
}

export function TierPill({ tier }: { tier: Tier | null }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold",
        tier ? TIER_STYLE[tier] : "bg-muted text-muted-foreground",
        "ring-0"
      )}
    >
      {tier ? `Tier ${tier}` : "Not rated"}
    </span>
  )
}
