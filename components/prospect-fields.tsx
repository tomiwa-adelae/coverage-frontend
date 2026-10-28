"use client"

import { useState } from "react"
import { useWatch, type UseFormReturn } from "react-hook-form"
import { z } from "zod"
import {
  IconCurrentLocation,
  IconExternalLink,
  IconMapPin,
  IconRoute,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { addDays, naira, niceDate } from "@/lib/format"
import { optionalEmail, phoneField } from "@/lib/schemas"
import { planSummary } from "@/lib/plans"
import { useCadences, useProspects } from "@/lib/queries"
import {
  CONSENT_LABEL,
  CONSENT_METHODS,
  LOST_REASONS,
  PRODUCTS,
  PRODUCT_LABEL,
  SOURCES,
  SOURCE_LABEL,
  STAGES,
  STAGE_LABEL,
  TIERS,
  TIER_HINT,
  WON_REASONS,
  type Product,
  type ProspectDetail,
  type ProspectInput,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/form-field"
import { MoneyInput } from "@/components/inputs"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"

const money = (label: string) =>
  z
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole naira amount`)
    .min(0, `${label} can’t be negative`)
    .nullable()

export const prospectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter the prospect’s name")
    .max(160, "Name must be 160 characters or fewer"),
  company: z.string().trim().max(160, "Keep it under 160 characters"),
  group: z.string().trim().max(60, "Keep it under 60 characters"),
  phone: phoneField,
  email: optionalEmail,
  tier: z.enum(["", ...TIERS]),
  stage: z.enum(STAGES),
  potential: money("Deposit potential"),
  funded: money("Funded balance"),
  nextAction: z.string().trim().max(200, "Keep it under 200 characters"),
  nextDate: z.string(),
  nextTime: z.string(),
  notes: z.string().max(4000, "Notes must be 4,000 characters or fewer"),
  outcomeReason: z
    .string()
    .trim()
    .max(300, "Keep the reason under 300 characters"),
  source: z.enum(["", ...SOURCES]),
  wantsProducts: z.array(z.enum(PRODUCTS)),
  holdsProducts: z.array(z.enum(PRODUCTS)),
  referredById: z.string(),
  birthMonth: z.string(),
  birthDay: z.string(),
  area: z.string().trim().max(60, "Keep it under 60 characters"),
  address: z.string().trim().max(300, "Keep it under 300 characters"),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  consentMethod: z.enum(["", ...CONSENT_METHODS]),
  consentNote: z.string().trim().max(300, "Keep it under 300 characters"),
  cadenceId: z.string(),
})
export type ProspectDraft = z.infer<typeof prospectSchema>
export type ProspectFormApi = UseFormReturn<ProspectDraft>

export function toDraft(p?: Partial<ProspectDetail>): ProspectDraft {
  return {
    name: p?.name ?? "",
    company: p?.company ?? "",
    group: p?.group ?? "",
    phone: p?.phone ?? "",
    email: p?.email ?? "",
    tier: p?.tier ?? "",
    stage: p?.stage ?? "IDENTIFIED",
    potential: p?.potential ?? null,
    funded: p?.funded ?? null,
    nextAction: p?.nextAction ?? "",
    nextDate: p?.nextDate ?? "",
    nextTime: p?.nextTime ?? "",
    notes: p?.notes ?? "",
    outcomeReason: p?.outcomeReason ?? "",
    source: p?.source ?? "",
    wantsProducts: p?.wantsProducts ?? [],
    holdsProducts: p?.holdsProducts ?? [],
    referredById: p?.referredById ?? "",
    birthMonth: p?.birthday?.slice(0, 2) ?? "",
    birthDay: p?.birthday?.slice(3, 5) ?? "",
    area: p?.area ?? "",
    address: p?.address ?? "",
    latitude: p?.latitude ?? null,
    longitude: p?.longitude ?? null,
    consentMethod: p?.consentMethod ?? "",
    consentNote: p?.consentNote ?? "",
    cadenceId: p?.cadenceId ?? "",
  }
}

export function toInput(d: ProspectDraft): ProspectInput {
  const s = (v: string) => v.trim() || null
  return {
    name: d.name.trim(),
    company: s(d.company),
    group: s(d.group),
    phone: s(d.phone),
    email: s(d.email),
    tier: d.tier || null,
    stage: d.stage,
    potential: d.potential,
    funded: d.funded,
    nextAction: s(d.nextAction),
    nextDate: d.nextDate || null,
    nextTime: (d.nextDate && d.nextTime) || null,
    notes: s(d.notes),
    outcomeReason: s(d.outcomeReason),
    source: d.source || null,
    wantsProducts: d.wantsProducts,
    holdsProducts: d.holdsProducts,
    referredById: d.referredById || null,
    birthday:
      d.birthMonth && d.birthDay ? `${d.birthMonth}-${d.birthDay}` : null,
    area: s(d.area),
    address: s(d.address),
    latitude: d.latitude,
    longitude: d.longitude,
    consentMethod: d.consentMethod || null,
    consentNote: s(d.consentNote),
    cadenceId: d.cadenceId || null,
  }
}

/** Small pill buttons used for quick picks (dates, amounts, groups). */
export function Chip({
  active,
  className,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors hover:bg-muted",
        active &&
          "border-primary bg-primary/10 text-primary dark:border-brand dark:bg-brand/15 dark:text-brand",
        className
      )}
      {...props}
    />
  )
}

export const QUICK_DATES: [string, number][] = [
  ["Today", 0],
  ["Tomorrow", 1],
  ["3 days", 3],
  ["1 week", 7],
  ["2 weeks", 14],
  ["1 month", 30],
]

export function NextStepFields({
  form,
  today,
}: {
  form: ProspectFormApi
  today: string
}) {
  const nextDate = useWatch({ control: form.control, name: "nextDate" })
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="nextAction"
        label="Action"
        render={(field) => (
          <Input
            {...field}
            placeholder="e.g. Call to introduce our SME account"
          />
        )}
      />
      <FormField
        control={form.control}
        name="nextDate"
        label="Date"
        render={(field) => (
          <div className="flex gap-2">
            <Input {...field} type="date" min={today} className="flex-1" />
            <Input
              {...form.register("nextTime")}
              type="time"
              className="w-32"
              aria-label="Time (optional)"
              title="Add a time to get a reminder before it"
            />
          </div>
        )}
      />
      <div className="-mt-2 flex flex-wrap gap-1.5">
        {QUICK_DATES.map(([label, n]) => {
          const d = addDays(today, n)
          return (
            <Chip
              key={n}
              active={nextDate === d}
              onClick={() =>
                form.setValue("nextDate", d, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            >
              {label}
            </Chip>
          )
        })}
        {nextDate && (
          <Chip
            className="text-muted-foreground"
            onClick={() => {
              form.setValue("nextDate", "", { shouldDirty: true })
              form.setValue("nextTime", "", { shouldDirty: true })
            }}
          >
            Clear
          </Chip>
        )}
      </div>
    </div>
  )
}

export function TierPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (tier: ProspectDraft["tier"]) => void
}) {
  return (
    <div className="grid gap-2">
      <div
        className="grid grid-cols-4 gap-1.5"
        role="radiogroup"
        aria-label="Tier"
      >
        {([...TIERS, ""] as const).map((t) => (
          <button
            key={t || "none"}
            type="button"
            role="radio"
            aria-checked={value === t}
            title={t ? TIER_HINT[t] : "Not rated yet"}
            onClick={() => onChange(t)}
            className={cn(
              "h-9 rounded-md border text-sm font-semibold transition-colors hover:bg-muted",
              value === t &&
                t === "A" &&
                "border-tier-a bg-tier-a/15 text-tier-a",
              value === t &&
                t === "B" &&
                "border-tier-b bg-tier-b/12 text-tier-b",
              value === t &&
                t === "C" &&
                "border-tier-c bg-tier-c/12 text-tier-c",
              value === t && !t && "border-foreground/30 bg-muted"
            )}
          >
            {t ? `Tier ${t}` : "Not sure"}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {value
          ? TIER_HINT[value as keyof typeof TIER_HINT]
          : "You can rate them later."}
      </p>
    </div>
  )
}

export const POTENTIAL_PRESETS = [1_000_000, 5_000_000, 10_000_000, 50_000_000]

export function StatusFields({ form }: { form: ProspectFormApi }) {
  const potential = useWatch({ control: form.control, name: "potential" })
  const stage = useWatch({ control: form.control, name: "stage" })
  const won = stage === "ACCOUNT_OPENED" || stage === "FUNDED"
  const reason = useWatch({ control: form.control, name: "outcomeReason" })
  const decided = won || stage === "DECLINED"
  return (
    <div className="space-y-5">
      <FormField
        control={form.control}
        name="tier"
        label="Tier"
        render={({ value, onChange }) => (
          <TierPicker value={value} onChange={onChange} />
        )}
      />
      <FormField
        control={form.control}
        name="stage"
        label="Stage"
        render={(field) => (
          <NativeSelect {...field}>
            {STAGES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {STAGE_LABEL[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      />
      {decided && (
        <FormField
          control={form.control}
          name="outcomeReason"
          label={won ? "Why did they choose us?" : "Why didn’t it work out?"}
          description="Shows up in Progress so you can see what wins and loses."
          render={(field) => (
            <>
              <div className="flex flex-wrap gap-1.5">
                {(won ? WON_REASONS : LOST_REASONS).map((r) => (
                  <Chip
                    key={r}
                    active={reason === r}
                    onClick={() =>
                      form.setValue("outcomeReason", reason === r ? "" : r, {
                        shouldDirty: true,
                      })
                    }
                  >
                    {r}
                  </Chip>
                ))}
              </div>
              <Input {...field} placeholder="Or write your own" />
            </>
          )}
        />
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <FormField
            control={form.control}
            name="potential"
            label="Deposit potential"
            render={({ value, onChange, ...field }) => (
              <MoneyInput
                {...field}
                value={value}
                onChange={onChange}
                placeholder="e.g. 10,000,000"
              />
            )}
          />
          <div className="flex flex-wrap gap-1.5">
            {POTENTIAL_PRESETS.map((n) => (
              <Chip
                key={n}
                active={potential === n}
                onClick={() =>
                  form.setValue("potential", n, { shouldDirty: true })
                }
              >
                {naira(n)}
              </Chip>
            ))}
          </div>
        </div>
        <FormField
          control={form.control}
          name="funded"
          label="Funded balance"
          description={
            won ? "Counts toward your target." : "Fill this in once they fund."
          }
          render={({ value, onChange, ...field }) => (
            <MoneyInput
              {...field}
              value={value}
              onChange={onChange}
              placeholder="e.g. 2,500,000"
            />
          )}
        />
      </div>
    </div>
  )
}

export function DetailsFields({
  form,
  groups = [],
  autoFocus,
  showNotes = true,
}: {
  form: ProspectFormApi
  groups?: string[]
  autoFocus?: boolean
  showNotes?: boolean
}) {
  const group = useWatch({ control: form.control, name: "group" })
  return (
    <div className="space-y-5">
      <FormField
        control={form.control}
        name="name"
        label="Name"
        render={(field) => (
          <Input
            {...field}
            autoFocus={autoFocus}
            autoComplete="off"
            placeholder="e.g. Mrs. Adaeze Okafor"
          />
        )}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="phone"
          label="Phone"
          render={(field) => (
            <Input
              {...field}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="e.g. 0803 123 4567"
            />
          )}
        />
        <FormField
          control={form.control}
          name="email"
          label="Email"
          render={(field) => (
            <Input
              {...field}
              type="email"
              autoComplete="off"
              placeholder="e.g. adaeze@okaforpharmacy.com"
            />
          )}
        />
        <FormField
          control={form.control}
          name="company"
          label="Company or business"
          render={(field) => (
            <Input {...field} placeholder="e.g. Okafor Pharmacy Ltd" />
          )}
        />
        <div className="grid gap-2">
          <FormField
            control={form.control}
            name="group"
            label="Group"
            render={(field) => (
              <Input
                {...field}
                list="prospect-groups"
                placeholder="e.g. Church, NYSC, Family"
              />
            )}
          />
          {groups.length > 0 && (
            <>
              <datalist id="prospect-groups">
                {groups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-1.5">
                {groups.slice(0, 6).map((g) => (
                  <Chip
                    key={g}
                    active={group === g}
                    onClick={() =>
                      form.setValue("group", group === g ? "" : g, {
                        shouldDirty: true,
                      })
                    }
                  >
                    {g}
                  </Chip>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {showNotes && (
        <FormField
          control={form.control}
          name="notes"
          label="Notes"
          render={(field) => (
            <Textarea
              {...field}
              rows={4}
              placeholder="Who they are, who they know, what they need"
            />
          )}
        />
      )}
    </div>
  )
}

/** Toggle chips for a set of products. */
function ProductPicker({
  value,
  onChange,
  label,
}: {
  value: Product[]
  onChange: (v: Product[]) => void
  label: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {PRODUCTS.map((p) => {
        const on = value.includes(p)
        return (
          <Chip
            key={p}
            active={on}
            onClick={() =>
              onChange(on ? value.filter((x) => x !== p) : [...value, p])
            }
          >
            {PRODUCT_LABEL[p]}
          </Chip>
        )
      })}
    </div>
  )
}

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString("en-GB", { month: "long" })
)

/** Where they came from, who referred them, birthday and products. */
export function RelationshipFields({
  form,
  selfId,
}: {
  form: ProspectFormApi
  /** Excluded from the "referred by" list. */
  selfId?: string
}) {
  const source = useWatch({ control: form.control, name: "source" })
  const referredById = useWatch({ control: form.control, name: "referredById" })
  const showReferrer = source === "REFERRAL" || !!referredById
  const { data: people } = useProspects({})
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="source"
          label="Where they came from"
          render={(field) => (
            <NativeSelect {...field}>
              <NativeSelectOption value="">Not recorded</NativeSelectOption>
              {SOURCES.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        />
        {showReferrer && (
          <FormField
            control={form.control}
            name="referredById"
            label="Referred by"
            render={(field) => (
              <NativeSelect {...field}>
                <NativeSelectOption value="">
                  Nobody in my list
                </NativeSelectOption>
                {people
                  ?.filter((p) => p.id !== selfId)
                  .map((p) => (
                    <NativeSelectOption key={p.id} value={p.id}>
                      {p.name}
                      {p.company ? ` (${p.company})` : ""}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            )}
          />
        )}
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Birthday</span>
        <div className="grid grid-cols-2 gap-2">
          <FormField
            control={form.control}
            name="birthMonth"
            render={(field) => (
              <NativeSelect {...field} aria-label="Birthday month">
                <NativeSelectOption value="">Month</NativeSelectOption>
                {MONTHS.map((m, i) => (
                  <NativeSelectOption
                    key={m}
                    value={String(i + 1).padStart(2, "0")}
                  >
                    {m}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          />
          <FormField
            control={form.control}
            name="birthDay"
            render={(field) => (
              <NativeSelect {...field} aria-label="Birthday day">
                <NativeSelectOption value="">Day</NativeSelectOption>
                {Array.from({ length: 31 }, (_, i) => (
                  <NativeSelectOption
                    key={i}
                    value={String(i + 1).padStart(2, "0")}
                  >
                    {i + 1}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          You&apos;ll see a reminder on Today a week before.
        </p>
      </div>

      <FormField
        control={form.control}
        name="wantsProducts"
        label="Interested in"
        render={({ value, onChange }) => (
          <ProductPicker
            value={value}
            onChange={onChange}
            label="Interested in"
          />
        )}
      />
      <FormField
        control={form.control}
        name="holdsProducts"
        label="Already has with us"
        description="Anything interested in but not held is a cross-sell chance."
        render={({ value, onChange }) => (
          <ProductPicker
            value={value}
            onChange={onChange}
            label="Already has with us"
          />
        )}
      />
    </div>
  )
}

const mapsUrl = (lat: number | null, lng: number | null, address: string) =>
  lat !== null && lng !== null
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

/** Area for visit planning, street address and a map pin. */
export function LocationFields({
  form,
  areas = [],
}: {
  form: ProspectFormApi
  areas?: string[]
}) {
  const [locating, setLocating] = useState(false)
  const [lat, lng, address] = useWatch({
    control: form.control,
    name: ["latitude", "longitude", "address"],
  })
  const pinned = lat !== null && lng !== null

  function locate() {
    if (!navigator.geolocation)
      return toast.error("This browser can’t share your location.")
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const round = (n: number) => Math.round(n * 1e6) / 1e6
        form.setValue("latitude", round(pos.coords.latitude), {
          shouldDirty: true,
        })
        form.setValue("longitude", round(pos.coords.longitude), {
          shouldDirty: true,
        })
        toast.success("Location pinned", {
          description: "Save to keep it.",
        })
      },
      (err) => {
        setLocating(false)
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Allow location access to pin where they are."
            : "Couldn’t get your location. Try again outside or near a window."
        )
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    )
  }

  return (
    <div className="space-y-5">
      <FormField
        control={form.control}
        name="area"
        label="Area"
        description="Used to group visits, e.g. Ikeja, Lekki Phase 1."
        render={(field) => (
          <>
            <Input
              {...field}
              list="prospect-areas"
              placeholder="e.g. Ikeja GRA"
            />
            <datalist id="prospect-areas">
              {areas.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </>
        )}
      />
      <FormField
        control={form.control}
        name="address"
        label="Address"
        render={(field) => (
          <Textarea {...field} rows={2} placeholder="Street, landmark, city" />
        )}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={locate}
          disabled={locating}
        >
          <IconCurrentLocation data-icon="inline-start" />
          {locating
            ? "Finding you…"
            : pinned
              ? "Re-pin to where I am"
              : "Pin where I am now"}
        </Button>
        {(pinned || address.trim()) && (
          <Button
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={
              <a
                href={mapsUrl(lat, lng, address)}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            <IconExternalLink data-icon="inline-start" /> Open in Maps
          </Button>
        )}
        {pinned && (
          <>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <IconMapPin className="size-3.5" /> Pinned
            </span>
            <Chip
              className="text-muted-foreground"
              onClick={() => {
                form.setValue("latitude", null, { shouldDirty: true })
                form.setValue("longitude", null, { shouldDirty: true })
              }}
            >
              Remove pin
            </Chip>
          </>
        )}
      </div>
    </div>
  )
}

/** Data protection: how and when the prospect agreed to be contacted. */
export function ConsentFields({
  form,
  consentAt,
}: {
  form: ProspectFormApi
  consentAt?: string | null
}) {
  const method = useWatch({ control: form.control, name: "consentMethod" })
  return (
    <div className="space-y-5">
      <FormField
        control={form.control}
        name="consentMethod"
        label="Agreed to be contacted"
        description={
          method && consentAt
            ? `Recorded ${niceDate(consentAt.slice(0, 10))}.`
            : "The NDPA asks you to keep a record of consent to marketing."
        }
        render={(field) => (
          <NativeSelect {...field}>
            <NativeSelectOption value="">Not recorded</NativeSelectOption>
            {CONSENT_METHODS.map((m) => (
              <NativeSelectOption key={m} value={m}>
                {CONSENT_LABEL[m]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      />
      {method && (
        <FormField
          control={form.control}
          name="consentNote"
          label="Consent note"
          render={(field) => (
            <Input
              {...field}
              placeholder="e.g. Agreed on call, OK with WhatsApp"
            />
          )}
        />
      )}
    </div>
  )
}

/** Pick a follow-up plan; logging contacts then walks through its steps. */
export function PlanField({
  form,
  prospect,
}: {
  form: ProspectFormApi
  prospect?: ProspectDetail
}) {
  const { data: plans } = useCadences()
  const cadenceId = useWatch({ control: form.control, name: "cadenceId" })
  const chosen = plans?.find((c) => c.id === cadenceId)
  const running =
    prospect?.cadence && prospect.cadenceId === cadenceId ? prospect : null
  return (
    <FormField
      control={form.control}
      name="cadenceId"
      label="Follow-up plan"
      description={
        running && running.cadenceStep !== null && running.cadence ? (
          <span className="inline-flex items-center gap-1">
            <IconRoute className="size-3.5" />
            Step {running.cadenceStep + 1} of {running.cadence.steps.length}:{" "}
            {running.cadence.steps[running.cadenceStep]?.action}
          </span>
        ) : chosen ? (
          `${planSummary(chosen.steps)}. Starts today when you save; each logged contact schedules the next step.`
        ) : (
          "Optional. A plan fills in the next step for you after each contact."
        )
      }
      render={(field) => (
        <NativeSelect {...field}>
          <NativeSelectOption value="">No plan</NativeSelectOption>
          {plans?.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
    />
  )
}
