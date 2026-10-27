"use client"

import { useRef } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"
import {
  IconCamera,
  IconLoader2,
  IconLogout,
  IconTrash,
} from "@tabler/icons-react"
import { api } from "@/lib/api"
import { disablePush } from "@/lib/push"
import { clearOfflineCache } from "@/lib/offline-cache"
import { showFormError } from "@/lib/forms"
import { newPasswordField, phoneField, withConfirm } from "@/lib/schemas"
import { useAvatar, useChangePassword, useMe, useUpdateMe } from "@/lib/queries"
import type { Me } from "@/lib/types"
import { FormField } from "@/components/form-field"
import { PasswordInput } from "@/components/inputs"
import { PasswordStrength } from "@/components/auth/password-strength"
import { PageHeader, PageSection } from "@/components/section"
import { UserAvatar, squareAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

export default function ProfilePage() {
  const { data: me } = useMe()
  return (
    <>
      <PageHeader
        title="Profile"
        description="Your details appear on emails you send to prospects."
      />
      {me ? (
        <>
          <AvatarCard me={me} />
          <DetailsForm
            key={me.name + me.phone + me.jobTitle + me.branch}
            me={me}
          />
          <PasswordForm />
          <SignOut />
        </>
      ) : (
        <div className="grid gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-72" />
        </div>
      )}
    </>
  )
}

function AvatarCard({ me }: { me: Me }) {
  const input = useRef<HTMLInputElement>(null)
  const avatar = useAvatar()
  const joined = new Date(me.createdAt).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  })

  async function pick(file: File | undefined) {
    if (input.current) input.current.value = ""
    if (!file) return
    let dataUrl: string
    try {
      dataUrl = await squareAvatar(file)
    } catch (e) {
      return toast.error((e as Error).message)
    }
    // Upload errors are toasted by the mutation hook.
    avatar.mutate(dataUrl, {
      onSuccess: () => toast.success("Profile picture updated"),
    })
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-5 text-center shadow-xs sm:flex-row sm:text-left">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="group relative rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label="Change profile picture"
      >
        <UserAvatar me={me} className="size-20 text-2xl" />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <IconCamera className="size-6" />
        </span>
        {avatar.isPending && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white">
            <IconLoader2 className="size-6 animate-spin" />
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold">{me.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {[me.jobTitle, me.branch].filter(Boolean).join(" · ") || me.email}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Member since {joined}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => input.current?.click()}
          disabled={avatar.isPending}
        >
          <IconCamera data-icon="inline-start" />
          {me.avatarUrl ? "Change photo" : "Upload photo"}
        </Button>
        {me.avatarUrl && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Remove photo"
            title="Remove photo"
            disabled={avatar.isPending}
            onClick={() =>
              avatar.mutate(null, {
                onSuccess: () => toast.success("Profile picture removed"),
              })
            }
          >
            <IconTrash />
          </Button>
        )}
      </div>
    </div>
  )
}

const detailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your full name")
    .max(120, "Name must be 120 characters or fewer"),
  phone: phoneField,
  jobTitle: z.string().trim().max(80, "Keep it under 80 characters"),
  branch: z.string().trim().max(80, "Keep it under 80 characters"),
})
type Details = z.infer<typeof detailsSchema>

function DetailsForm({ me }: { me: Me }) {
  const update = useUpdateMe()
  const form = useForm<Details>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      name: me.name,
      phone: me.phone ?? "",
      jobTitle: me.jobTitle ?? "",
      branch: me.branch ?? "",
    },
  })

  async function onSubmit(values: Details) {
    try {
      await update.mutateAsync(values)
      toast.success("Profile saved")
    } catch (e) {
      showFormError(form, e)
    }
  }

  return (
    <PageSection title="Your details">
      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="rounded-xl border bg-card p-4 shadow-xs sm:p-5"
      >
        <FieldGroup>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              label="Full name"
              render={(field) => (
                <Input
                  {...field}
                  autoComplete="name"
                  placeholder="e.g. Tomi Adeyemi"
                />
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              label="Phone"
              render={(field) => (
                <Input
                  {...field}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="e.g. 0803 123 4567"
                />
              )}
            />
            <FormField
              control={form.control}
              name="jobTitle"
              label="Job title"
              render={(field) => (
                <Input
                  {...field}
                  autoComplete="organization-title"
                  placeholder="e.g. Relationship Manager"
                />
              )}
            />
            <FormField
              control={form.control}
              name="branch"
              label="Branch"
              render={(field) => (
                <Input {...field} placeholder="e.g. Victoria Island" />
              )}
            />
          </div>
          <div className="grid gap-1.5">
            <p className="text-sm font-medium">Email</p>
            <Input value={me.email} readOnly disabled aria-label="Email" />
            <p className="text-sm text-muted-foreground">
              Your sign-in email. Replies to emails you send from Coverage come
              here.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            {form.formState.isDirty && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => form.reset()}
              >
                Discard
              </Button>
            )}
            <Button
              type="submit"
              disabled={!form.formState.isDirty || form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Saving…" : "Save details"}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </PageSection>
  )
}

const passwordSchema = withConfirm(
  {
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: newPasswordField,
  },
  "newPassword"
)
type Passwords = z.infer<typeof passwordSchema>

function PasswordForm() {
  const change = useChangePassword()
  const form = useForm<Passwords>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })
  const newPassword = useWatch({ control: form.control, name: "newPassword" })

  async function onSubmit({ currentPassword, newPassword }: Passwords) {
    try {
      await change.mutateAsync({ currentPassword, newPassword })
      form.reset()
      toast.success("Password changed", {
        description: "Other devices have been signed out.",
      })
    } catch (e) {
      showFormError(form, e)
    }
  }

  return (
    <PageSection title="Change password">
      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="rounded-xl border bg-card p-4 shadow-xs sm:p-5"
      >
        <FieldGroup>
          <FormField
            control={form.control}
            name="currentPassword"
            label="Current password"
            render={(field) => (
              <PasswordInput
                {...field}
                autoComplete="current-password"
                placeholder="Enter your current password"
              />
            )}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="newPassword"
              label="New password"
              render={(field) => (
                <PasswordInput
                  {...field}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                />
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              label="Confirm new password"
              render={(field) => (
                <PasswordInput
                  {...field}
                  autoComplete="new-password"
                  placeholder="Type it again"
                />
              )}
            />
          </div>
          {newPassword && <PasswordStrength password={newPassword} />}
          <div className="flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Updating…" : "Update password"}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </PageSection>
  )
}

function SignOut() {
  async function signOut() {
    // Stop this device getting someone's reminders, and drop the offline copy.
    await disablePush().catch(() => {})
    await api("/auth/logout", { method: "POST" }).catch(() => {})
    clearOfflineCache()
    toast.success("Signed out")
    window.location.href = "/login"
  }
  return (
    <PageSection title="Session">
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <p className="text-sm text-muted-foreground">
          Sign out of Coverage on this device.
        </p>
        <Button variant="outline" onClick={signOut}>
          <IconLogout data-icon="inline-start" /> Sign out
        </Button>
      </div>
    </PageSection>
  )
}
