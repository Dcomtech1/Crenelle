'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, KeyRound, ShieldAlert, LogOut, Trash2, CheckCircle2, UserCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { fieldCls, labelCls, hintCls } from '@/lib/form-styles'
import { deleteAccountAction, sendPasswordResetEmailAction } from '@/app/actions/auth'

interface AccountSettingsFormProps {
  user: any
}

export function AccountSettingsForm({ user: initialUser }: AccountSettingsFormProps) {
  const router = useRouter()
  const [user, setUser] = useState(initialUser)
  const [displayName, setDisplayName] = useState(initialUser.user_metadata?.full_name ?? '')
  const [updatingProfile, setUpdatingProfile] = useState(false)
  const [loadingIdentities, setLoadingIdentities] = useState(false)

  // Passwords
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)

  // Other sessions
  const [signingOutOthers, setSigningOutOthers] = useState(false)

  // Account deletion transition
  const [deletePending, startDeleteTransition] = useTransition()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')

  // Check URL query parameters for errors
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err) {
      toast.error(err)
      // Clear URL params
      router.replace('/settings/account')
    }
  }, [router])

  const refreshUser = async () => {
    setLoadingIdentities(true)
    const supabase = createClient()
    const { data: { user: latestUser } } = await supabase.auth.getUser()
    if (latestUser) {
      setUser(latestUser)
      setDisplayName(latestUser.user_metadata?.full_name ?? '')
    }
    setLoadingIdentities(false)
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setUpdatingProfile(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        data: { full_name: displayName }
      })
      if (error) {
        toast.error(`Failed to update display name: ${error.message}`)
      } else {
        toast.success('Display name updated successfully.')
        await refreshUser()
      }
    } catch (err) {
      toast.error('An unexpected error occurred.')
    } finally {
      setUpdatingProfile(false)
    }
  }

  const identities = user?.identities ?? []
  const hasGoogle = identities.some((id: any) => id.provider === 'google')
  const hasEmail = identities.some((id: any) => id.provider === 'email')
  const totalIdentities = identities.length

  const handleLinkGoogle = async () => {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/settings/account`
        }
      })
      if (error) {
        toast.error(`Failed to link Google: ${error.message}`)
      }
    } catch (err) {
      toast.error('An unexpected error occurred.')
    }
  }

  const handleUnlinkGoogle = async () => {
    const googleIdentity = identities.find((id: any) => id.provider === 'google')
    if (!googleIdentity) return

    if (totalIdentities <= 1) {
      toast.error('Cannot disconnect: You must have at least one other login method connected.')
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.unlinkIdentity(googleIdentity)
      if (error) {
        toast.error(`Failed to unlink Google: ${error.message}`)
      } else {
        toast.success('Google account disconnected successfully.')
        await refreshUser()
      }
    } catch (err) {
      toast.error('An unexpected error occurred.')
    }
  }

  const validatePassword = (pass: string): string | null => {
    if (pass.length < 8) return 'Password must be at least 8 characters long.'
    if (!/[A-Z]/.test(pass)) return 'Password must contain at least one uppercase letter.'
    if (!/[a-z]/.test(pass)) return 'Password must contain at least one lowercase letter.'
    if (!/[0-9]/.test(pass)) return 'Password must contain at least one number.'
    if (!/[^A-Za-z0-9]/.test(pass)) return 'Password must contain at least one special character.'
    return null
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) {
      toast.error('Password is required.')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    const valError = validatePassword(password)
    if (valError) {
      toast.error(valError)
      return
    }

    setUpdatingPassword(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        toast.error(`Failed to update password: ${error.message}`)
      } else {
        toast.success(hasEmail ? 'Password updated successfully.' : 'Password created successfully.')
        setPassword('')
        setConfirmPassword('')
        await refreshUser()
      }
    } catch (err) {
      toast.error('An unexpected error occurred.')
    } finally {
      setUpdatingPassword(false)
    }
  }

  const handleSendResetEmail = async () => {
    setSendingReset(true)
    try {
      const result = await sendPasswordResetEmailAction()
      if (result?.error) {
        toast.error(`Failed to send email: ${result.error}`)
      } else {
        toast.success('Password reset email sent. Please check your inbox.')
      }
    } catch (err) {
      toast.error('An unexpected error occurred.')
    } finally {
      setSendingReset(false)
    }
  }

  const handleSignOutOthers = async () => {
    setSigningOutOthers(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut({ scope: 'others' })
      if (error) {
        toast.error(`Failed to sign out other sessions: ${error.message}`)
      } else {
        toast.success('Successfully signed out of all other sessions.')
      }
    } catch (err) {
      toast.error('An unexpected error occurred.')
    } finally {
      setSigningOutOthers(false)
    }
  }

  const handleDeleteAccount = () => {
    if (deleteInput !== 'delete my account') {
      toast.error('Please type the confirmation phrase exactly.')
      return
    }

    startDeleteTransition(async () => {
      try {
        const result = await deleteAccountAction()
        if (result?.error) {
          toast.error(result.error)
        }
      } catch (err) {
        toast.error('Failed to delete account.')
      }
    })
  }

  return (
    <div className="space-y-8 animate-fade-up">
      {/* ── Profile Details ── */}
      <div className="border border-border bg-card">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <div className="w-1 h-4 bg-copper shrink-0" aria-hidden="true" />
          <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground">
            Profile Details
          </h2>
        </div>
        <div className="px-6 py-6 space-y-5">
          <div className="flex flex-col gap-2">
            <span className={labelCls}>Email address</span>
            <span className="font-sans text-sm text-foreground bg-muted border border-border px-4 py-3 select-all">
              {user?.email}
            </span>
            <p className={hintCls}>Your email identity is fixed and used for account communications.</p>
          </div>

          <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="full-name" className={labelCls}>
                Display Name
              </label>
              <input
                id="full-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className={fieldCls}
              />
              <p className={hintCls}>Used to personalize event dashboards and signatures.</p>
            </div>
            <button
              type="submit"
              disabled={updatingProfile || displayName === (user.user_metadata?.full_name ?? '')}
              className="self-start inline-flex items-center gap-2 bg-foreground text-background font-sans text-xs font-semibold uppercase tracking-[0.12em] px-6 py-3 hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {updatingProfile && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
              Save changes
            </button>
          </form>
        </div>
      </div>

      {/* ── Connected Accounts ── */}
      <div className="border border-border bg-card">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-4 bg-copper shrink-0" aria-hidden="true" />
            <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground">
              Connected Accounts
            </h2>
          </div>
          {loadingIdentities && <Loader2 className="size-3.5 animate-spin text-copper" />}
        </div>
        <div className="px-6 py-6 space-y-6">
          <p className="font-sans text-xs text-muted-foreground leading-relaxed">
            Link social accounts to log in with a single click. Unlinking a service requires having another authentication method active.
          </p>

          <div className="flex flex-col gap-4 p-4 border border-border bg-muted/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <div className="flex flex-col">
                  <span className="font-sans text-xs font-semibold text-foreground uppercase tracking-wide">
                    Google Sign-in
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {hasGoogle ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </div>
              </div>

              {hasGoogle ? (
                <button
                  type="button"
                  onClick={handleUnlinkGoogle}
                  disabled={totalIdentities <= 1 || loadingIdentities}
                  className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-denied border border-denied/40 hover:border-denied bg-transparent px-4 py-2 transition-all hover:bg-denied/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLinkGoogle}
                  disabled={loadingIdentities}
                  className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-foreground border border-border hover:border-foreground/40 bg-transparent px-4 py-2 transition-all hover:bg-foreground/5 cursor-pointer"
                >
                  Connect
                </button>
              )}
            </div>

            {hasGoogle && totalIdentities <= 1 && (
              <div className="mt-2 text-[10px] font-mono text-copper uppercase tracking-wide flex items-center gap-1.5 border-t border-border/40 pt-2">
                <ShieldAlert className="size-3.5 text-copper" />
                Cannot disconnect Google: Set a password first to keep your account accessible.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Password Management ── */}
      <div className="border border-border bg-card">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <KeyRound className="size-4 text-copper" />
          <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground">
            Password Settings
          </h2>
        </div>
        <div className="px-6 py-6 space-y-6">
          {!hasEmail ? (
            <div className="p-4 border border-border bg-muted/40 text-xs text-muted-foreground leading-relaxed">
              <p className="font-mono text-[10px] text-copper uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <ShieldAlert className="size-3.5" />
                No local password configured
              </p>
              You are currently logging in via Google. Set a password below to allow logging in with your email address and password.
            </div>
          ) : null}

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="new-pass" className={labelCls}>
                  {hasEmail ? 'New password' : 'Create password'}
                </label>
                <input
                  id="new-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={fieldCls}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="confirm-pass" className={labelCls}>
                  Confirm password
                </label>
                <input
                  id="confirm-pass"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={fieldCls}
                />
              </div>
            </div>

            <div className="p-3 border border-border/40 bg-muted/20 font-mono text-[9px] text-muted-foreground uppercase tracking-wider space-y-1">
              <p className="font-sans font-bold text-[10px] text-foreground/80 tracking-normal mb-1 text-left">Password requirements:</p>
              <div className="flex items-center gap-1.5">
                <span className={password.length >= 8 ? 'text-moss' : ''}>{password.length >= 8 ? '✓' : '•'} At least 8 characters</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={/[A-Z]/.test(password) ? 'text-moss' : ''}>{/[A-Z]/.test(password) ? '✓' : '•'} Upper-case letter</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={/[a-z]/.test(password) ? 'text-moss' : ''}>{/[a-z]/.test(password) ? '✓' : '•'} Lower-case letter</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={/[0-9]/.test(password) ? 'text-moss' : ''}>{/[0-9]/.test(password) ? '✓' : '•'} Numerical digit</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={/[^A-Za-z0-9]/.test(password) ? 'text-moss' : ''}>{/[^A-Za-z0-9]/.test(password) ? '✓' : '•'} Special character</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={updatingPassword || !password || password !== confirmPassword}
                className="inline-flex items-center gap-2 bg-foreground text-background font-sans text-xs font-semibold uppercase tracking-[0.12em] px-6 py-3 hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {updatingPassword && <Loader2 className="size-3.5 animate-spin" />}
                {hasEmail ? 'Update Password' : 'Set Password'}
              </button>

              {hasEmail && (
                <button
                  type="button"
                  onClick={handleSendResetEmail}
                  disabled={sendingReset}
                  className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-foreground/60 hover:text-foreground px-4 py-3 border border-border hover:border-foreground/30 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {sendingReset && <Loader2 className="size-3.5 animate-spin" />}
                  Send reset link
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* ── Security & Sessions ── */}
      <div className="border border-border bg-card">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <UserCircle className="size-4 text-copper" />
          <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground">
            Sessions & Security
          </h2>
        </div>
        <div className="px-6 py-6 space-y-4">
          <p className="font-sans text-xs text-muted-foreground leading-relaxed">
            Logged in on another machine or public device? Terminate all other sessions except your current browser window to secure your account.
          </p>
          <button
            type="button"
            onClick={handleSignOutOthers}
            disabled={signingOutOthers}
            className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-foreground/80 hover:text-foreground px-4 py-3 border border-border hover:border-foreground/40 hover:bg-foreground/5 transition-all cursor-pointer flex items-center gap-2"
          >
            {signingOutOthers ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <LogOut className="size-3.5 text-copper" />
            )}
            Sign out of other sessions
          </button>
        </div>
      </div>

      {/* ── Danger Zone ── */}
      <div className="border border-denied/30 bg-card">
        <div className="px-6 py-4 border-b border-denied/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trash2 className="size-4 text-denied" />
            <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-denied">
              Danger Zone
            </h2>
          </div>
        </div>
        <div className="px-6 py-6">
          {!showDeleteConfirm ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                  Permanently delete your user profile, configurations, and all managed events.
                </p>
                <p className="font-mono text-[9px] text-denied uppercase tracking-wider">
                  ⚠️ This action is final and cannot be recovered.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-denied border border-denied/40 hover:border-denied bg-transparent px-4 py-3 hover:bg-denied/5 transition-all cursor-pointer shrink-0"
              >
                Delete account
              </button>
            </div>
          ) : (
            <div className="border border-denied/50 p-4 bg-denied/5 space-y-4 animate-fade-up">
              <p className="font-sans text-xs text-foreground/90 font-medium">
                To confirm deletion, please type <code className="bg-muted px-1.5 py-0.5 border border-border text-denied select-all">delete my account</code> below:
              </p>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="delete my account"
                className="w-full bg-muted border border-denied/40 text-foreground font-sans text-sm px-4 py-3 placeholder:text-muted-foreground/30 focus:outline-none focus:border-denied transition-colors rounded-none"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deletePending || deleteInput !== 'delete my account'}
                  className="inline-flex items-center gap-2 bg-denied text-paper font-sans text-xs font-semibold uppercase tracking-[0.12em] px-6 py-3 hover:opacity-85 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {deletePending && <Loader2 className="size-3.5 animate-spin" />}
                  Confirm Permanent Deletion
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteInput('')
                  }}
                  className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-foreground/60 hover:text-foreground px-4 py-3 border border-border hover:border-foreground/30 bg-transparent transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
