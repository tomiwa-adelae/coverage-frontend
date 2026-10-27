import Image from "next/image"
import { cn } from "@/lib/utils"

/** The ProvidusUnity mark on a slate tile. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg bg-[#30444F] shadow-sm ring-1 ring-white/10",
        className
      )}
    >
      <Image
        src="/images/providus-mark.png"
        alt=""
        width={312}
        height={266}
        priority
        className="h-auto w-[62%]"
      />
    </span>
  )
}

/** Mark + "Coverage" with the bank as a caption. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="leading-none">
        <span className="block text-[17px] font-semibold tracking-tight">
          Coverage
        </span>
        <span className="mt-1 block text-[11px] font-medium tracking-wide opacity-65">
          ProvidusUnity Bank
        </span>
      </span>
    </span>
  )
}
