'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signupSchema } from '@/lib/validations/auth'
import { ZodError } from 'zod'

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')

  const requirements = [
    { label: 'MIN_8_CHARACTERS', test: (pw: string) => pw.length >= 8 },
    { label: 'UPPERCASE_LETTER', test: (pw: string) => /[A-Z]/.test(pw) },
    { label: 'LOWERCASE_LETTER', test: (pw: string) => /[a-z]/.test(pw) },
    { label: 'NUMERIC_DIGIT', test: (pw: string) => /[0-9]/.test(pw) },
    { label: 'SPECIAL_CHARACTER', test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
  ]

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    try {
      // Client-side validation
      const data = Object.fromEntries(formData.entries())
      signupSchema.parse(data)
    } catch (err) {
      if (err instanceof ZodError) {
        setError(err.issues[0].message)
      } else {
        setError('An unexpected error occurred')
      }
      setLoading(false)
      return
    }

    const result = await signup(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal mb-3">
          SYSTEM_ACCESS // NEW_ORGANIZER
        </p>
        <h1 className="font-display text-5xl uppercase text-foreground leading-none">
          Create Account
        </h1>
      </div>

      <form action={handleSubmit} className="flex flex-col gap-6" noValidate>
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="border-2 border-denied bg-denied/10 p-4 font-mono text-sm text-denied uppercase tracking-wide"
          >
            ⚠ {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label
            htmlFor="signup-email"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/60"
          >
            Email Address
          </label>
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="w-full bg-secondary border-2 border-foreground/20 text-foreground font-mono text-sm px-4 py-3 placeholder:text-foreground/20 focus:outline-none focus:border-signal transition-colors"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="signup-password"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/60"
          >
            Password <span className="text-foreground/30">(MIN. 8 CHARS + UPPER/LOWER/NUM/SPEC)</span>
          </label>
          <input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            className="w-full bg-secondary border-2 border-foreground/20 text-foreground font-mono text-sm px-4 py-3 placeholder:text-foreground/20 focus:outline-none focus:border-signal transition-colors"
          />

          {/* Password Requirements Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2 bg-foreground/5 p-3 border border-foreground/10">
            {requirements.map((req) => {
              const isMet = req.test(password)
              return (
                <div 
                  key={req.label} 
                  className={cn(
                    "flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider transition-colors",
                    isMet ? "text-signal" : "text-foreground/30"
                  )}
                >
                  <div className={cn(
                    "size-3 border flex items-center justify-center shrink-0",
                    isMet ? "border-signal bg-signal/10" : "border-foreground/20"
                  )}>
                    {isMet && <Check className="size-2" strokeWidth={4} />}
                  </div>
                  {req.label}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="signup-confirm"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/60"
          >
            Confirm Password
          </label>
          <input
            id="signup-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            placeholder="••••••••"
            className="w-full bg-secondary border-2 border-foreground/20 text-foreground font-mono text-sm px-4 py-3 placeholder:text-foreground/20 focus:outline-none focus:border-signal transition-colors"
          />
        </div>

        <Button
          type="submit"
          variant="signal"
          size="lg"
          disabled={loading}
          className="w-full h-14 text-xl mt-2"
        >
          {loading ? 'CREATING...' : 'CREATE ACCOUNT →'}
        </Button>
      </form>

      <p className="font-mono text-xs text-foreground/30 uppercase tracking-widest mt-8 text-center">
        Already have an account?{' '}
        <Link href="/login" className="text-signal hover:text-foreground transition-colors underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  )
}
