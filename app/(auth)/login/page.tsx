'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { loginSchema } from '@/lib/validations/auth'
import { ZodError } from 'zod'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    try {
      const data = Object.fromEntries(formData.entries())
      loginSchema.parse(data)
      const result = await login(formData)
      if (result?.error) {
        setError(result.error)
        setLoading(false)
      }
    } catch (err) {
      setError(err instanceof ZodError ? err.issues[0].message : 'An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-10">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-copper mb-4">
          Organizer access
        </p>
        <h1 className="font-display text-4xl font-semibold text-foreground leading-tight tracking-tight">
          Welcome back.
        </h1>
        <p className="font-sans text-sm text-muted-foreground mt-2">
          Sign in to manage your events and guests.
        </p>
      </div>

      <form action={handleSubmit} className="flex flex-col gap-5" noValidate>
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="border-l-2 border-destructive bg-destructive/10 px-4 py-3 font-sans text-xs text-foreground/80 leading-relaxed"
          >
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="login-email" className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Email address
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="w-full bg-muted border border-border text-foreground font-sans text-sm px-4 py-3 placeholder:text-muted-foreground/50 focus:outline-none focus:border-copper transition-colors"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="login-password" className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Password
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="w-full bg-muted border border-border text-foreground font-sans text-sm px-4 py-3 placeholder:text-muted-foreground/50 focus:outline-none focus:border-copper transition-colors"
          />
        </div>

        {/* bg-foreground text-background = correct inversion in both modes */}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full bg-foreground text-background font-sans text-sm font-semibold uppercase tracking-[0.14em] py-4 hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? 'Verifying...' : 'Sign in →'}
        </button>
      </form>

      <p className="font-sans text-xs text-muted-foreground mt-8 text-center">
        No account?{' '}
        <Link href="/signup" className="text-copper hover:text-copper underline underline-offset-4 transition-opacity hover:opacity-80">
          Create one
        </Link>
      </p>
    </div>
  )
}
