"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { IconEye, IconEyeOff } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"

type InputProps = Omit<React.ComponentProps<"input">, "type">

/** Password field with a show/hide toggle. */
export function PasswordInput({ className, ...props }: InputProps) {
  const [visible, setVisible] = useState(false)
  return (
    <InputGroup className={className}>
      <InputGroupInput
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          title={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <IconEyeOff /> : <IconEye />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}

const group = (digits: string) =>
  digits ? Number(digits).toLocaleString("en-NG") : ""

type NumericProps = Omit<InputProps, "value" | "onChange" | "defaultValue"> & {
  value: number | null | undefined
  onChange: (value: number | null) => void
}

/**
 * Whole-number input that shows thousands separators as you type (180,000,000)
 * and keeps the caret in place while the commas move around it.
 */
export function NumberInput({
  value,
  onChange,
  className,
  inGroup,
  ...props
}: NumericProps & { inGroup?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const text = value == null ? "" : group(String(value))

  // After the formatted value renders, put the caret back after the same digit.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || caret.current == null || document.activeElement !== el) return
    let seen = 0
    let pos = 0
    while (pos < el.value.length && seen < caret.current) {
      if (/\d/.test(el.value[pos])) seen++
      pos++
    }
    el.setSelectionRange(pos, pos)
    caret.current = null
  }, [text])

  const Comp = inGroup ? InputGroupInput : Input
  return (
    <Comp
      ref={ref}
      inputMode="numeric"
      autoComplete="off"
      className={cn("tabular-nums", className)}
      {...props}
      value={text}
      onChange={(e) => {
        const el = e.currentTarget
        const before = el.value.slice(0, el.selectionStart ?? el.value.length)
        caret.current = before
          .replace(/\D/g, "")
          .replace(/^0+(?=\d)/, "").length
        const digits = el.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "")
        // Stay within safe integers; anything longer is a typo for naira amounts.
        onChange(digits ? Number(digits.slice(0, 15)) : null)
      }}
    />
  )
}

/** Money in whole units with a currency prefix. Naira unless told otherwise. */
export function MoneyInput({
  currency = "₦",
  className,
  ...props
}: NumericProps & { currency?: string }) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon>
        <InputGroupText className="font-semibold text-foreground/70">
          {currency}
        </InputGroupText>
      </InputGroupAddon>
      <NumberInput inGroup placeholder="0" {...props} />
    </InputGroup>
  )
}
