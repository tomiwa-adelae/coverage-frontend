import { IconFlame, IconLayoutKanban, IconTarget } from "@tabler/icons-react"
import { BrandLockup } from "@/components/brand"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-svh bg-background lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <BrandPanel />
      <main className="relative flex min-h-[calc(100svh-9rem)] flex-col px-4 py-8 sm:px-8 lg:min-h-svh lg:justify-center lg:py-12">
        <div className="mx-auto w-full max-w-[25rem] animate-in duration-500 fade-in slide-in-from-bottom-3">
          {children}
        </div>
        <p className="mx-auto mt-10 text-center text-xs text-muted-foreground lg:absolute lg:inset-x-0 lg:bottom-6 lg:mt-0">
          © {new Date().getFullYear()} Coverage · For ProvidusUnity Bank
          relationship managers
        </p>
      </main>
    </div>
  )
}

/** Slate brand side with a live-looking preview of the app. Compact header on phones. */
function BrandPanel() {
  return (
    <aside className="relative isolate overflow-hidden bg-[#30444F] text-white">
      {/* Gold glow and fine grid for depth. */}
      <div
        aria-hidden
        className="absolute -top-32 -right-24 -z-10 size-[28rem] rounded-full bg-[#FDB813]/15 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -left-32 -z-10 size-[26rem] rounded-full bg-[#FDB813]/10 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] [background-size:44px_44px] opacity-[0.07]"
      />

      <div className="flex h-full flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6 sm:px-8 lg:px-14 lg:py-12">
        <BrandLockup captionClassName="text-[#FDB813] opacity-100" />

        <div className="mt-6 lg:mt-auto">
          <h2 className="max-w-md text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl lg:text-[2.6rem]">
            Every prospect covered.{" "}
            <span className="text-[#FDB813]">Every target met.</span>
          </h2>
          <p className="mt-3 hidden max-w-md text-[15px] leading-relaxed text-white/70 sm:block">
            Know who to call today, keep every follow-up on time, and watch your
            deposits climb toward ₦180,000,000.
          </p>
        </div>

        <Preview />

        <ul className="mt-10 hidden gap-5 text-sm text-white/75 lg:grid lg:grid-cols-3">
          <Feature icon={IconTarget} title="Daily focus">
            Today&apos;s calls, in order.
          </Feature>
          <Feature icon={IconLayoutKanban} title="Clear pipeline">
            From first call to funded.
          </Feature>
          <Feature icon={IconFlame} title="Momentum">
            Goals and streaks that stick.
          </Feature>
        </ul>
      </div>
    </aside>
  )
}

function Feature({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <li>
      <Icon className="size-5 text-[#FDB813]" />
      <p className="mt-2 font-semibold text-white">{title}</p>
      <p className="mt-0.5 text-white/60">{children}</p>
    </li>
  )
}

/** Static mock of the Today screen, so the sign-in page shows what's inside. */
function Preview() {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <div
      className="relative mt-10 hidden max-w-md lg:[@media(min-height:780px)]:block"
      aria-hidden
    >
      <div className="animate-in rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-sm delay-150 duration-700 fill-mode-both fade-in slide-in-from-bottom-4">
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 56 56" className="size-16 -rotate-90">
            <circle
              cx="28"
              cy="28"
              r={r}
              fill="none"
              strokeWidth="5"
              className="stroke-white/10"
            />
            <circle
              cx="28"
              cy="28"
              r={r}
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * 0.2}
              className="stroke-[#FDB813]"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold">8 of 10 contacts today</p>
            <p className="mt-0.5 text-xs text-white/60">
              2 more to hit your goal
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FDB813]/15 px-2.5 py-1 text-xs font-semibold text-[#FDB813]">
            <IconFlame className="size-3.5" /> 6
          </span>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-xs text-white/60">
            <span>Funded so far</span>
            <span className="font-semibold text-white tabular-nums">
              ₦112,500,000{" "}
              <span className="font-normal text-white/50">of ₦180,000,000</span>
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[62.5%] rounded-full bg-gradient-to-r from-[#FDB813]/70 to-[#FDB813]" />
          </div>
        </div>
      </div>

      <div className="absolute -right-6 -bottom-8 w-56 animate-in rounded-xl border border-white/10 bg-[#263741] p-3.5 shadow-xl delay-300 duration-700 fill-mode-both fade-in slide-in-from-right-4">
        <p className="text-[11px] font-medium tracking-wide text-white/50 uppercase">
          Due today
        </p>
        {[
          ["AO", "Adaeze Okafor", "Send forms"],
          ["TB", "Tunde Bakare", "Follow-up call"],
        ].map(([i, n, a]) => (
          <div key={n} className="mt-2.5 flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-full bg-[#FDB813]/20 text-[10px] font-bold text-[#FDB813]">
              {i}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium">{n}</span>
              <span className="block truncate text-[11px] text-white/50">
                {a}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
