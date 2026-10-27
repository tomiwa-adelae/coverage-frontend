import type { FieldValues, Path, UseFormReturn } from "react-hook-form"
import { toast } from "sonner"
import { ApiError } from "./api"

/**
 * Shows an API error the way the user expects: the message as a toast, and any
 * per-field messages pinned under the matching inputs.
 */
export function showFormError<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: unknown
) {
  const message =
    error instanceof Error ? error.message : "Something went wrong."
  if (error instanceof ApiError) {
    const known = Object.keys(form.getValues())
    for (const [field, msg] of Object.entries(error.fields)) {
      if (known.includes(field))
        form.setError(field as Path<T>, { type: "server", message: msg })
    }
  }
  toast.error(message)
}
