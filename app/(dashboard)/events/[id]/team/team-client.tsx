'use client'

import { useState, useEffect, useTransition } from 'react'
import { useParams, notFound } from 'next/navigation'
import { UserPlus, Trash2, Users, Shield, Eye, Star } from 'lucide-react'
import { getTeamMembers, inviteTeamMember, removeTeamMember, updateTeamMemberRole } from '@/app/actions/team'
import { fieldCls, labelCls } from '@/lib/form-styles'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionHeader } from '@/components/section-header'
import { EmptyState } from '@/components/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import type { EventMember, MemberRole } from '@/lib/types'

const roleConfig: Record<MemberRole, { label: string; description: string; icon: React.ReactNode; cls: string }> = {
  viewer: {
    label: 'Viewer',
    description: 'Read-only access to event data, guests, registrations, and entry logs.',
    icon: <Eye className="h-4 w-4" />,
    cls: 'bg-foreground/8 text-foreground/70 border-foreground/20',
  },
  scanner_manager: {
    label: 'Scanner Manager',
    description: 'All viewer permissions + can create, activate, and delete scanner links for ushers.',
    icon: <Shield className="h-4 w-4" />,
    cls: 'bg-signal/10 text-signal border-signal/30',
  },
  co_organiser: {
    label: 'Co-Organiser',
    description: 'Full collaboration — can manage guests, send invitations, and manage scanner links. Cannot edit or delete the event.',
    icon: <Star className="h-4 w-4" />,
    cls: 'bg-copper/10 text-copper border-copper/30',
  },
}

export default function TeamPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [members, setMembers] = useState<EventMember[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<EventMember | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('viewer')
  const [isPending, startTransition] = useTransition()
  const [isRemoving, startRemoveTransition] = useTransition()
  const [isUpdatingRole, startUpdateTransition] = useTransition()
  const [loading, setLoading] = useState(true)

  async function loadMembers() {
    try {
      const result = await getTeamMembers(eventId)
      if (result.error) {
        // If this errors, the user is not the owner — access denied
        return
      }
      setMembers(result.members)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [eventId])

  function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    startTransition(async () => {
      const result = await inviteTeamMember(eventId, email.trim(), role)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`Invitation sent to ${email}`)
        setEmail('')
        setRole('viewer')
        setInviteOpen(false)
        loadMembers()
      }
    })
  }

  function handleRoleChange(member: EventMember, newRole: MemberRole) {
    startUpdateTransition(async () => {
      const result = await updateTeamMemberRole(member.id, eventId, newRole)
      if (result?.error) toast.error(result.error)
      else { toast.success('Role updated'); loadMembers() }
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 border-b-2 border-foreground/10 pb-6">
        <SectionHeader
          eyebrow="TEAM_ACCESS"
          title="Co-Hosts"
          subtitle={loading ? "Loading co-hosts..." : `${members.length} co-host${members.length !== 1 ? 's' : ''} with access to this event`}
        />

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button variant="signal" className="gap-2 h-12 px-6 text-sm shrink-0">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              INVITE_CO-HOST
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-background border border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-semibold text-foreground">
                Invite Co-Host
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="flex flex-col gap-5 mt-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="invite-email" className={labelCls}>Email address *</label>
                <input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="co-host@example.com"
                  required
                  className={fieldCls}
                />
                <p className="font-sans text-[10px] text-muted-foreground/60 uppercase tracking-wide">
                  They must already have a Crenelle account
                </p>
              </div>

              {/* Role selector */}
              <div className="flex flex-col gap-2">
                <span className={labelCls}>Permission Level *</span>
                <div className="flex flex-col gap-2">
                  {(Object.keys(roleConfig) as MemberRole[]).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex items-start gap-3 p-3 border-2 text-left transition-all ${
                        role === r
                          ? 'border-signal bg-signal/5'
                          : 'border-foreground/15 hover:border-foreground/30'
                      }`}
                    >
                      <span className={`mt-0.5 ${role === r ? 'text-signal' : 'text-foreground/50'}`}>
                        {roleConfig[r].icon}
                      </span>
                      <div>
                        <p className="font-sans text-sm font-semibold text-foreground">{roleConfig[r].label}</p>
                        <p className="font-sans text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                          {roleConfig[r].description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending || !email.trim()}
                className="w-full bg-foreground text-background font-sans text-sm font-semibold uppercase tracking-[0.12em] py-3.5 hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {isPending ? 'Sending invite...' : 'Send invite →'}
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Permissions info panel */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(Object.keys(roleConfig) as MemberRole[]).map(r => (
          <div key={r} className={`flex items-start gap-3 p-4 border rounded-sm ${roleConfig[r].cls}`}>
            <span className="mt-0.5 shrink-0">{roleConfig[r].icon}</span>
            <div>
              <p className="font-sans text-xs font-bold uppercase tracking-widest mb-1">{roleConfig[r].label}</p>
              <p className="font-sans text-[11px] leading-relaxed opacity-80">{roleConfig[r].description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Members list */}
      {loading ? (
        <div className="flex flex-col gap-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-card border border-border p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              {/* Avatar circle placeholder */}
              <div className="h-10 w-10 shrink-0 bg-foreground/5 border border-foreground/10" />
              {/* Details placeholder */}
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-2.5 w-24" />
              </div>
              {/* Role selector placeholder */}
              <div className="flex items-center gap-2 shrink-0">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="NO_CO-HOSTS"
          subtitle="Invite a co-host to give them access to collaborate on this event"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {members.map(member => {
            const rc = roleConfig[member.role]
            return (
              <div
                key={member.id}
                className="bg-card border border-border p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-copper/30 transition-colors"
              >
                {/* Avatar initials */}
                <div className="h-10 w-10 shrink-0 bg-foreground/8 border border-foreground/15 flex items-center justify-center">
                  <span className="font-display text-sm font-semibold text-foreground/70 uppercase">
                    {(member.member_name ?? member.member_email ?? '?').slice(0, 2)}
                  </span>
                </div>

                {/* Identity */}
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-semibold text-foreground truncate">
                    {member.member_name ?? 'Unnamed'}
                  </p>
                  <p className="font-sans text-[11px] text-muted-foreground truncate">
                    {member.member_email}
                  </p>
                  <p className="font-sans text-[10px] text-muted-foreground/50 mt-0.5">
                    Added {new Date(member.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </p>
                </div>

                {/* Role selector */}
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={member.role}
                    onChange={e => handleRoleChange(member, e.target.value as MemberRole)}
                    disabled={isUpdatingRole}
                    aria-label={`Change role for ${member.member_email}`}
                    className={`font-sans text-xs font-semibold uppercase tracking-widest px-3 py-1.5 border appearance-none cursor-pointer bg-background disabled:opacity-50 ${rc.cls}`}
                  >
                    {(Object.keys(roleConfig) as MemberRole[]).map(r => (
                      <option key={r} value={r}>{roleConfig[r].label}</option>
                    ))}
                  </select>

                  {/* Remove */}
                  <button
                    onClick={() => setRemoveTarget(member)}
                    aria-label={`Remove ${member.member_email} as co-host`}
                    className="inline-flex items-center justify-center h-9 w-9 border border-destructive/20 text-destructive/50 hover:border-destructive/50 hover:text-destructive hover:bg-destructive/6 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Remove confirmation */}
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={open => !open && setRemoveTarget(null)}
        title="REMOVE_CO-HOST"
        description="THIS_ACTION_IS_REVERSIBLE"
        subject={removeTarget?.member_email}
        subjectLabel="CO-HOST"
        body="This person will immediately lose access to this event. You can re-invite them at any time."
        confirmLabel="REMOVE_ACCESS"
        isPending={isRemoving}
        onConfirm={() => {
          if (!removeTarget) return
          startRemoveTransition(async () => {
            const result = await removeTeamMember(removeTarget.id, eventId)
            if (result?.error) toast.error(result.error)
            else { toast.success('Co-host removed'); loadMembers(); setRemoveTarget(null) }
          })
        }}
      />
    </div>
  )
}
