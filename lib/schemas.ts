import { z } from "zod"

// Mirrors the API's rules so most mistakes are caught before a round trip.

export const emailField = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .pipe(z.email("Enter a valid email address"))

export const newPasswordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be 128 characters or fewer")
  .regex(/[A-Za-z]/, "Password must include at least one letter")
  .regex(/\d/, "Password must include at least one number")

export const phoneField = z
  .string()
  .trim()
  .max(30, "Phone number is too long")
  .refine(
    (v) => !v || /^\+?[\d\s()-]{7,}$/.test(v),
    "Enter a valid phone number, e.g. 0803 123 4567"
  )

export const optionalEmail = z
  .string()
  .trim()
  .refine(
    (v) => !v || z.email().safeParse(v).success,
    "Enter a valid email address"
  )

/** Two password fields that must match. */
export const withConfirm = <T extends z.ZodRawShape>(
  shape: T,
  field: keyof T & string
) =>
  z.object({ ...shape, confirmPassword: z.string() }).refine(
    (v) => {
      const values = v as Record<string, unknown>
      return values[field] === values.confirmPassword
    },
    { message: "Passwords don’t match", path: ["confirmPassword"] }
  )
