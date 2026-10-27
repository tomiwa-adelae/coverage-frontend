"use client"

import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  IconAddressBook,
  IconAlertTriangle,
  IconChevronDown,
  IconId,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { addDays, localToday, naira } from "@/lib/format"
import { showFormError } from "@/lib/forms"
import {
  useAiStatus,
  useCreateProspect,
  useProspects,
  useProspectsMeta,
  useScanCard,
} from "@/lib/queries"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { useOpenProspect } from "@/components/prospect-sheet"
import {
  Chip,
  DetailsFields,
  NextStepFields,
  POTENTIAL_PRESETS,
  PlanField,
  RelationshipFields,
  TierPicker,
  prospectSchema,
  toDraft,
  toInput,
  type ProspectDraft,
} from "@/components/prospect-fields"
import { FormField } from "@/components/form-field"
import { MoneyInput } from "@/components/inputs"
import { Textarea } from "@/components/ui/textarea"

const AddContext = createContext<() => void>(() => {})

/** Open the quick "add a prospect" dialog from anywhere. */
export const useAddProspect = () => useContext(AddContext)

export function AddProspectProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  // Bumping the key gives "Save & add another" a fresh form.
  const [round, setRound] = useState(0)
  const show = useCallback(() => {
    setRound((r) => r + 1)
    setOpen(true)
  }, [])

  return (
    <AddContext.Provider value={show}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-1.5rem)] gap-0 overflow-y-auto p-0 sm:max-w-xl">
          {open && (
            <AddProspectForm
              key={round}
              onDone={() => setOpen(false)}
              onAnother={() => setRound((r) => r + 1)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AddContext.Provider>
  )
}

// The Contact Picker API exists on Android Chrome; elsewhere the button is hidden.
type ContactsApi = {
  select: (
    props: string[],
    opts?: { multiple?: boolean }
  ) => Promise<{ name?: string[]; tel?: string[]; email?: string[] }[]>
}
const contactsApi = () =>
  typeof navigator !== "undefined"
    ? (navigator as Navigator & { contacts?: ContactsApi }).contacts
    : undefined
const useHasContacts = () =>
  useSyncExternalStore(
    () => () => {},
    () => !!contactsApi(),
    () => false
  )

const PHONE_IN_TEXT = /(\+?\d[\d\s-]{6,}\d)/
const EMAIL_IN_TEXT = /([^\s@,;]+@[^\s@,;]+\.[^\s@,;]+)/

/**
 * "Adaeze Okafor 0803 123 4567 adaeze@x.com" pasted into the name field is split
 * into name, phone and email.
 */
function splitPasted(text: string) {
  const phone = text.match(PHONE_IN_TEXT)?.[1]?.trim()
  const email = text.match(EMAIL_IN_TEXT)?.[1]
  if (!phone && !email) return null
  const name = text
    .replace(phone ?? "", "")
    .replace(email ?? "", "")
    .replace(/[,;|:\-–]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return { name, phone, email }
}

const digits = (s: string) => s.replace(/\D/g, "").replace(/^234/, "0")

/** Shrinks a phone photo to a JPEG small enough to send (about 1600px wide). */
async function photoToDataUrl(file: File, max = 1600) {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("We couldn’t read that photo. Try again.")
  })
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL("image/jpeg", 0.85)
}

function AddProspectForm({
  onDone,
  onAnother,
}: {
  onDone: () => void
  onAnother: () => void
}) {
  const today = localToday()
  const create = useCreateProspect()
  const openProspect = useOpenProspect()
  const { data: meta } = useProspectsMeta()
  const hasContacts = useHasContacts()
  const [more, setMore] = useState(false)
  const [another, setAnother] = useState(false)
  const { data: ai } = useAiStatus()
  const scan = useScanCard()
  const cardInput = useRef<HTMLInputElement>(null)

  const form = useForm<ProspectDraft>({
    resolver: zodResolver(prospectSchema),
    // A first call tomorrow keeps every new prospect on the Today list.
    defaultValues: {
      ...toDraft(),
      nextAction: "First call",
      nextDate: addDays(today, 1),
    },
  })

  const name = useDeferredValue(
    useWatch({ control: form.control, name: "name" }).trim()
  )
  const phone = useDeferredValue(
    digits(useWatch({ control: form.control, name: "phone" }))
  )
  const duplicate = useDuplicate(name, phone)
  const potential = useWatch({ control: form.control, name: "potential" })

  async function importContact() {
    try {
      const [c] = (await contactsApi()?.select(["name", "tel", "email"])) ?? []
      if (!c) return
      if (c.name?.[0]) form.setValue("name", c.name[0], { shouldDirty: true })
      if (c.tel?.[0]) form.setValue("phone", c.tel[0], { shouldDirty: true })
      if (c.email?.[0])
        form.setValue("email", c.email[0], { shouldDirty: true })
      toast.success("Contact imported")
    } catch {
      toast.error("We couldn’t open your contacts. Type the details instead.")
    }
  }

  async function scanCard(file: File | undefined) {
    if (!file) return
    try {
      const card = await scan.mutateAsync(await photoToDataUrl(file))
      const set = (
        field: "name" | "company" | "phone" | "email" | "address",
        v: string
      ) => {
        if (v.trim()) form.setValue(field, v.trim(), { shouldDirty: true })
      }
      set("name", card.name)
      set("company", card.company)
      set("phone", card.phone)
      set("email", card.email)
      set("address", card.address)
      if (card.jobTitle.trim()) {
        const notes = form.getValues("notes")
        form.setValue(
          "notes",
          notes ? `${notes}\n${card.jobTitle.trim()}` : card.jobTitle.trim(),
          { shouldDirty: true }
        )
      }
      if (card.address.trim() || card.jobTitle.trim()) setMore(true)
      toast.success("Card read", {
        description: "Check the details before saving.",
      })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      if (cardInput.current) cardInput.current.value = ""
    }
  }

  async function save(values: ProspectDraft) {
    try {
      const p = await create.mutateAsync(toInput(values))
      toast.success(`Added ${p.name}`, {
        description: values.nextDate
          ? "It’s on your list for the follow-up date you picked."
          : "Set a next step so it shows up on Today.",
        action: { label: "Open", onClick: () => openProspect(p.id) },
      })
      if (another) onAnother()
      else onDone()
    } catch (e) {
      showFormError(form, e)
    }
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(save, () =>
        toast.error("Some details need fixing", {
          description: "Check the highlighted fields.",
        })
      )}
    >
      <DialogHeader className="border-b p-5 sm:p-6">
        <DialogTitle className="text-xl">Add a prospect</DialogTitle>
        <DialogDescription>
          Only the name is required. Tip: paste “Name 0803… email” into the name
          field and we’ll split it for you.
        </DialogDescription>
        {(hasContacts || ai?.enabled) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {hasContacts && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={importContact}
              >
                <IconAddressBook data-icon="inline-start" /> Pick from contacts
              </Button>
            )}
            {ai?.enabled && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={scan.isPending}
                  onClick={() => cardInput.current?.click()}
                >
                  <IconId data-icon="inline-start" />
                  {scan.isPending ? "Reading card…" : "Scan business card"}
                </Button>
                <input
                  ref={cardInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => scanCard(e.target.files?.[0])}
                />
              </>
            )}
          </div>
        )}
      </DialogHeader>

      <FieldGroup className="gap-6 p-5 sm:p-6">
        <div
          onPaste={(e) => {
            if (!(e.target instanceof HTMLInputElement)) return
            if (e.target.name !== "name") return
            const parts = splitPasted(e.clipboardData.getData("text"))
            if (!parts) return
            e.preventDefault()
            form.setValue("name", parts.name, { shouldDirty: true })
            if (parts.phone)
              form.setValue("phone", parts.phone, { shouldDirty: true })
            if (parts.email)
              form.setValue("email", parts.email, { shouldDirty: true })
            toast("Split into name, phone and email", { duration: 2500 })
          }}
        >
          <DetailsFields
            form={form}
            groups={meta?.groups}
            autoFocus
            showNotes={false}
          />
        </div>

        {duplicate && (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <p className="min-w-0 flex-1">
              <span className="font-medium">{duplicate.name}</span>
              {duplicate.company ? ` (${duplicate.company})` : ""} is already in
              your list with the same {duplicate.by}.
            </p>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => {
                onDone()
                openProspect(duplicate.id)
              }}
            >
              Open
            </Button>
          </div>
        )}

        <FormField
          control={form.control}
          name="tier"
          label="How promising?"
          render={({ value, onChange }) => (
            <TierPicker value={value} onChange={onChange} />
          )}
        />

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

        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="mb-3 text-sm font-semibold">First follow-up</p>
          <div className="space-y-5">
            <PlanField form={form} />
            <NextStepFields form={form} today={today} />
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            aria-expanded={more}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <IconChevronDown
              className={cn(
                "size-4 transition-transform",
                more && "rotate-180"
              )}
            />
            {more ? "Fewer details" : "More: notes, source, birthday, products"}
          </button>
          {more && (
            <div className="mt-3 space-y-5">
              <RelationshipFields form={form} />
              <FormField
                control={form.control}
                name="notes"
                label="Notes"
                render={(field) => (
                  <Textarea
                    {...field}
                    rows={3}
                    placeholder="Who they are, who introduced you, what they need"
                  />
                )}
              />
              <FormField
                control={form.control}
                name="address"
                label="Address"
                render={(field) => (
                  <Textarea
                    {...field}
                    rows={2}
                    placeholder="Street, landmark, city"
                  />
                )}
              />
            </div>
          )}
        </div>
      </FieldGroup>

      <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-popover/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="ghost"
          className="sm:mr-auto"
          onClick={onDone}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="outline"
          disabled={form.formState.isSubmitting}
          onClick={() => setAnother(true)}
        >
          Save & add another
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={form.formState.isSubmitting}
          onClick={() => setAnother(false)}
        >
          {form.formState.isSubmitting ? "Saving…" : "Add prospect"}
        </Button>
      </div>
    </form>
  )
}

/** Looks for an existing prospect with the same phone number or exact name. */
function useDuplicate(name: string, phone: string) {
  // The full list is usually cached already and small enough to scan here.
  const { data } = useProspects({})
  if (!data) return null
  if (phone.length >= 7) {
    const tail = phone.slice(-10)
    const p = data.find((x) => x.phone && digits(x.phone).endsWith(tail))
    if (p) return { ...p, by: "phone number" }
  }
  if (name.length >= 3) {
    const p = data.find(
      (x) => x.name.trim().toLowerCase() === name.toLowerCase()
    )
    if (p) return { ...p, by: "name" }
  }
  return null
}
