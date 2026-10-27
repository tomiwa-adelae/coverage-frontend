"use client"

import {
  Controller,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"

export type FieldControlProps<
  T extends FieldValues,
  N extends FieldPath<T>,
> = ControllerRenderProps<T, N> & {
  id: string
  "aria-invalid": boolean
  "aria-describedby"?: string
}

/**
 * shadcn Field bound to react-hook-form: label, control, description and the
 * field's error message, with ids and aria wiring handled.
 */
export function FormField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  labelAction,
  id,
  className,
  render,
}: {
  control: Control<T>
  name: N
  label?: React.ReactNode
  description?: React.ReactNode
  /** Rendered at the end of the label row, e.g. a "Forgot password?" link. */
  labelAction?: React.ReactNode
  id?: string
  className?: string
  render: (field: FieldControlProps<T, N>) => React.ReactNode
}) {
  const fieldId = id ?? `field-${name.replace(/\./g, "-")}`
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          {(label || labelAction) && (
            <div className="flex items-center justify-between gap-2">
              {label && <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>}
              {labelAction}
            </div>
          )}
          {render({
            ...field,
            id: fieldId,
            "aria-invalid": fieldState.invalid,
            "aria-describedby": fieldState.error
              ? `${fieldId}-error`
              : undefined,
          })}
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError id={`${fieldId}-error`} errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}
