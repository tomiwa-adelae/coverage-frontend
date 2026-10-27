"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  IconCopy,
  IconCrown,
  IconRefresh,
  IconTrendingDown,
  IconTrendingUp,
  IconUserMinus,
  IconUsersGroup,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { nairaShort } from "@/lib/format"
import {
  useCreateTeam,
  useJoinTeam,
  useLeaveTeam,
  useNewInviteCode,
  useRemoveMember,
  useRenameTeam,
  useTeam,
} from "@/lib/queries"
import type { Team, TeamMember } from "@/lib/types"
import { EmptyNote, PageHeader, PageSection } from "@/components/section"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

/** "K7QMX4PA" -> "K7QM-X4PA" */
const showCode = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`

export default function TeamPage() {
  const { data, isError } = useTeam()
  return (
    <>
      <PageHeader
        title="Team"
        description="See how the team is tracking. Members share headline numbers only, never prospects."
      />
      {isError ? (
        <EmptyNote>
          Couldn&apos;t load your team. Refresh to try again.
        </EmptyNote>
      ) : !data ? (
        <Skeleton className="h-64 w-full" />
      ) : data.team ? (
        <TeamView team={data.team} />
      ) : (
        <NoTeam />
      )}
    </>
  )
}

function NoTeam() {
  const join = useJoinTeam()
  const create = useCreateTeam()
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <form
        className="rounded-xl border bg-card p-4 shadow-xs"
        onSubmit={async (e) => {
          e.preventDefault()
          setError(null)
          try {
            const t = await join.mutateAsync(code)
            toast.success(`You joined ${t?.name}`)
          } catch (err) {
            setError((err as Error).message)
          }
        }}
      >
        <h2 className="font-semibold">Join your team</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask your manager for the invite code.
        </p>
        <Label htmlFor="invite" className="sr-only">
          Invite code
        </Label>
        <Input
          id="invite"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="K7QM-X4PA"
          autoCapitalize="characters"
          className="mt-3 font-mono tracking-widest uppercase"
          aria-invalid={!!error}
        />
        {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          className="mt-3 w-full"
          disabled={join.isPending || code.replace(/[\s-]/g, "").length !== 8}
        >
          {join.isPending ? "Joining…" : "Join team"}
        </Button>
      </form>
      <form
        className="rounded-xl border bg-card p-4 shadow-xs"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await create.mutateAsync(name)
            toast.success("Team created. Share the invite code with your team.")
          } catch (err) {
            toast.error((err as Error).message)
          }
        }}
      >
        <h2 className="font-semibold">Start a team</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          For managers: see your RMs&apos; progress in one place.
        </p>
        <Label htmlFor="team-name" className="sr-only">
          Team name
        </Label>
        <Input
          id="team-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ikeja branch RMs"
          className="mt-3"
        />
        <Button
          type="submit"
          variant="outline"
          className="mt-3 w-full"
          disabled={create.isPending || !name.trim()}
        >
          {create.isPending ? "Creating…" : "Create team"}
        </Button>
      </form>
    </div>
  )
}

function TeamView({ team }: { team: Team }) {
  const manager = team.role === "MANAGER"
  const leave = useLeaveTeam()
  const [confirmLeave, setConfirmLeave] = useState(false)
  const pct = team.totals.target
    ? Math.min(100, (team.totals.balance / team.totals.target) * 100)
    : 0

  return (
    <>
      <div className="rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
            <IconUsersGroup className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            {manager ? (
              <TeamName team={team} />
            ) : (
              <h2 className="text-lg font-semibold">{team.name}</h2>
            )}
            <p className="text-sm text-muted-foreground">
              {team.members.length} member{team.members.length === 1 ? "" : "s"}{" "}
              · you&apos;re {manager ? "the manager" : "a member"}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Figure
            label="Team balance"
            value={`${nairaShort(team.totals.balance)} / ${nairaShort(team.totals.target)}`}
          />
          <Figure
            label="Likely from pipelines"
            value={nairaShort(team.totals.weightedPipeline)}
          />
          <Figure
            label="Contacts this week"
            value={team.totals.contactsThisWeek}
          />
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Team balance against combined target"
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {manager && team.inviteCode && <InviteCode code={team.inviteCode} />}

      <PageSection title="Leaderboard" hint="Ranked by progress to target.">
        <ol className="divide-y rounded-xl border bg-card shadow-xs">
          {team.members.map((m, i) => (
            <MemberRow
              key={m.id}
              m={m}
              rank={i + 1}
              canRemove={manager && !m.isMe}
            />
          ))}
        </ol>
      </PageSection>

      <div className="mt-8 flex justify-end">
        <Button
          variant={confirmLeave ? "destructive" : "ghost"}
          size="sm"
          disabled={leave.isPending}
          onClick={() => {
            if (!confirmLeave) return setConfirmLeave(true)
            leave.mutate(undefined, {
              onSuccess: () => toast.success(`You left ${team.name}`),
              onError: (e) => toast.error(e.message),
            })
          }}
        >
          {confirmLeave ? "Tap again to leave" : "Leave team"}
        </Button>
      </div>
    </>
  )
}

function TeamName({ team }: { team: Team }) {
  const rename = useRenameTeam()
  const [name, setName] = useState(team.name)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        rename.mutate(name, {
          onSuccess: () => toast.success("Team renamed"),
          onError: (err) => toast.error(err.message),
        })
      }}
      className="flex items-center gap-2"
    >
      <Label htmlFor="rename" className="sr-only">
        Team name
      </Label>
      <Input
        id="rename"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 border-transparent px-1 text-lg font-semibold shadow-none hover:border-input"
      />
      {name.trim() !== team.name && name.trim() && (
        <Button type="submit" size="sm" disabled={rename.isPending}>
          Save
        </Button>
      )}
    </form>
  )
}

function InviteCode({ code }: { code: string }) {
  const regenerate = useNewInviteCode()
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">Invite code</p>
        <p className="font-mono text-xl font-semibold tracking-widest">
          {showCode(code)}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(showCode(code))
          toast.success("Invite code copied")
        }}
      >
        <IconCopy data-icon="inline-start" /> Copy
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={regenerate.isPending}
        onClick={() =>
          regenerate.mutate(undefined, {
            onSuccess: () =>
              toast.success("New code made. The old one no longer works."),
          })
        }
      >
        <IconRefresh data-icon="inline-start" /> New code
      </Button>
    </div>
  )
}

function MemberRow({
  m,
  rank,
  canRemove,
}: {
  m: TeamMember
  rank: number
  canRemove: boolean
}) {
  const remove = useRemoveMember()
  const [confirm, setConfirm] = useState(false)
  const Trend = m.onPace ? IconTrendingUp : IconTrendingDown
  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        m.isMe && "bg-primary/5"
      )}
    >
      <span className="w-5 text-center text-sm font-semibold text-muted-foreground tabular-nums">
        {rank}
      </span>
      <UserAvatar
        me={{ name: m.name, avatarUrl: m.avatarUrl }}
        className="size-9"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          {m.name}
          {m.isMe && (
            <span className="text-xs text-muted-foreground">(you)</span>
          )}
          {m.role === "MANAGER" && (
            <IconCrown className="size-3.5 text-warning" aria-label="Manager" />
          )}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:w-40">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, m.progress * 100)}%` }}
            />
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {Math.round(m.progress * 100)}% · {nairaShort(m.balance)}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {m.contactsThisWeek} contacts this week · {m.accountsOpened30d} opened
          in 30 days
        </p>
      </div>
      <span
        className={cn(
          "hidden items-center gap-1 text-xs font-medium sm:inline-flex",
          m.onPace ? "text-success" : "text-destructive"
        )}
      >
        <Trend className="size-4" />
        {m.onPace ? "On pace" : "Behind"}
      </span>
      {canRemove && (
        <Button
          size={confirm ? "sm" : "icon-sm"}
          variant={confirm ? "destructive" : "ghost"}
          aria-label={`Remove ${m.name} from the team`}
          disabled={remove.isPending}
          onClick={() => {
            if (!confirm) return setConfirm(true)
            remove.mutate(m.id, {
              onSuccess: () => toast.success(`Removed ${m.name}`),
              onError: (e) => toast.error(e.message),
            })
          }}
        >
          <IconUserMinus />
          {confirm && "Remove"}
        </Button>
      )}
    </li>
  )
}

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  )
}
