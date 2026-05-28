'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { loginSchema } from '@/lib/validations/auth'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get('error')
    if (oauthError) {
      setError(oauthError)
    }
  }, [])

  async function handleSubmit(formData: FormData) {
    if (googleLoading) return
    setLoading(true)
    setError(null)
    
    try {
      const data = Object.fromEntries(formData.entries())
      loginSchema.parse(data)
    } catch (err) {
      setError(err instanceof ZodError ? err.issues[0].message : 'An unexpected error occurred')
      setLoading(false)
      return
    }

    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    if (loading) return
    setGoogleLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setError(error.message)
        setGoogleLoading(false)
      }
    } catch (err) {
      setError('An unexpected error occurred during Google sign in')
      setGoogleLoading(false)
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
          disabled={loading || googleLoading}
          className="mt-2 w-full bg-foreground text-background font-sans text-sm font-semibold uppercase tracking-[0.14em] py-4 hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? 'Verifying...' : 'Sign in →'}
        </button>
      </form>

      <div className="relative flex py-4 items-center">
        <div className="grow border-t border-border"></div>
        <span className="shrink mx-4 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Or</span>
        <div className="grow border-t border-border"></div>
      </div>

      <Button
        type="button"
        variant="primary"
        onClick={handleGoogleLogin}
        disabled={loading || googleLoading}
        className="w-full h-14 font-mono text-sm tracking-widest flex items-center justify-center gap-3"
      >
        {googleLoading ? (
          'CONNECTING...'
        ) : (
          <>
            <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            CONTINUE WITH GOOGLE →
          </>
        )}
      </Button>

      <p className="font-sans text-xs text-muted-foreground mt-8 text-center">
        No account?{' '}
        <Link href="/signup" className="text-copper hover:text-copper underline underline-offset-4 transition-opacity hover:opacity-80">
          Create one
        </Link>
      </p>
    </div>
  )
}

