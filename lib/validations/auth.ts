import { z } from 'zod'

export const signupSchema = z.object({
  email: z.string().email('INVALID_EMAIL_ADDRESS'),
  password: z
    .string()
    .min(8, 'PASSWORD_MIN_8_CHARACTERS')
    .regex(/[A-Z]/, 'PASSWORD_NEED_UPPERCASE')
    .regex(/[a-z]/, 'PASSWORD_NEED_LOWERCASE')
    .regex(/[0-9]/, 'PASSWORD_NEED_NUMBER')
    .regex(/[^A-Za-z0-9]/, 'PASSWORD_NEED_SPECIAL_CHARACTER'),
  confirm: z.string()
}).refine((data) => data.password === data.confirm, {
  message: "PASSWORDS_DO_NOT_MATCH",
  path: ["confirm"],
})

export const loginSchema = z.object({
  email: z.email('INVALID_EMAIL_ADDRESS'),
  password: z.string().min(1, 'PASSWORD_REQUIRED'),
})

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
