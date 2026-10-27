/* eslint-disable @next/next/no-img-element -- avatars are small data URLs, nothing to optimise */
import { cn } from "@/lib/utils"
import { initials } from "@/lib/format"
import type { Me } from "@/lib/types"

/** The signed-in user's picture, or their initials on gold. */
export function UserAvatar({
  me,
  className,
}: {
  me: Pick<Me, "name" | "avatarUrl"> | undefined
  className?: string
}) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-brand text-xs font-semibold text-brand-foreground",
        className
      )}
    >
      {me?.avatarUrl ? (
        <img src={me.avatarUrl} alt="" className="size-full object-cover" />
      ) : me ? (
        initials(me.name)
      ) : null}
    </span>
  )
}

/**
 * Center-crops an image file to a square and re-encodes it small enough to
 * store with the account (256px JPEG, typically 15–30 KB).
 */
export async function squareAvatar(file: File, size = 256): Promise<string> {
  if (!/^image\/(jpeg|png|webp|gif|heic|heif)$/.test(file.type))
    throw new Error("Choose a JPG, PNG or WebP image.")
  if (file.size > 15 * 1024 * 1024)
    throw new Error("That image is over 15 MB. Choose a smaller one.")

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("We couldn’t read that image. Try a JPG or PNG.")
  })
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size
  )
  bitmap.close()
  return canvas.toDataURL("image/jpeg", 0.85)
}
