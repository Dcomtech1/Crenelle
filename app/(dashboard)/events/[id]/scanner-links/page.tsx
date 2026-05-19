'use client'

import { useState, useEffect, useTransition } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Copy, ToggleLeft, ToggleRight, Trash2, Link2 } from 'lucide-react'
import { createScannerLink, toggleScannerLink, deleteScannerLink } from '@/app/actions/scanner-links'
import { createClient } from '@/lib/supabase/client'
import { fieldCls, labelCls } from '@/lib/form-styles'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionHeader } from '@/components/section-header'
import { EmptyState } from '@/components/empty-state'
import { toast } from 'sonner'
import type { ScannerLink } from '@/lib/types'

export default function ScannerLinksPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [links, setLinks] = useState<ScannerLink[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ScannerLink | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()

  async function loadLinks() {
    const supabase = createClient()
    const { data } = await supabase
      .from('scanner_links')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
    setLinks(data ?? [])
  }

  useEffect(() => {
    loadLinks()

    // Poll every 10s as a reliable fallback
    const poll = setInterval(loadLinks, 10000)

    const supabase = createClient()
    const channel = supabase
      .channel(`scanner-links-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scanner_links', filter: `event_id=eq.${eventId}` }, () => loadLinks())
      .subscribe()

    return () => {
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [eventId])

  const scanUrl = (token: string) =>
    `${window.location.origin}/scan/${token}`

  async function handleCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createScannerLink(eventId, formData)
      if (result?.error) toast.error(result.error)
      else { toast.success('Scanner link created'); setAddOpen(false); loadLinks() }
    })
  }

  async function handleToggle(link: ScannerLink) {
    startTransition(async () => {
      await toggleScannerLink(link.id, eventId, !link.is_active)
      loadLinks()
    })
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(scanUrl(token))
    toast.success('Link copied to clipboard')
  }

  return (
    <div>
      {/* Section header + New Link button */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 border-b-2 border-foreground/10 pb-6">
        <SectionHeader
          eyebrow="USHER_ACCESS_TOKENS"
          title="Scanner Links"
          subtitle="Share these links with ushers — no login needed"
        />

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <button className="inline-flex items-center gap-2 bg-foreground text-background font-sans text-sm font-semibold uppercase tracking-[0.12em] px-6 py-3 hover:opacity-80 transition-opacity shrink-0">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New link
            </button>
          </DialogTrigger>
          <DialogContent className="bg-background border border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-semibold text-foreground">Create scanner link</DialogTitle>
            </DialogHeader>
            <form action={handleCreate} className="flex flex-col gap-5 mt-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="sl-label" className={labelCls}>Gate / Label</label>
                <input
                  id="sl-label"
                  name="label"
                  placeholder="e.g. Main Entrance, VIP Gate"
                  defaultValue="Main Entrance"
                  className={fieldCls}
                />
                <p className="font-sans text-[10px] text-muted-foreground/60 uppercase tracking-wide">
                  Helps identify which usher is at which gate
                </p>
              </div>
              <button type="submit" disabled={isPending}
                className="w-full bg-foreground text-background font-sans text-sm font-semibold uppercase tracking-[0.12em] py-3.5 hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {isPending ? 'Creating...' : 'Create link →'}
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Link list */}
      {links.length === 0 ? (
        <EmptyState
          icon={<Link2 className="h-10 w-10" />}
          title="NO_LINKS_YET"
          subtitle="Create a scanner link and share it with your ushers on event day"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {links.map((link) => (
            <div
              key={link.id}
              className="bg-card border border-border p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-copper/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-display text-xl font-semibold text-foreground">{link.label}</span>
                  <span
                    className={`font-mono text-[9px] uppercase tracking-widest px-2 py-1 ${link.is_active ? 'status-admitted' : 'bg-foreground/10 text-foreground/40'}`}
                    aria-label={`Status: ${link.is_active ? 'Active' : 'Inactive'}`}
                  >
                    {link.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <p className="font-sans text-[10px] text-muted-foreground truncate">
                  {scanUrl(link.token)}
                </p>
              </div>

              <div className="flex gap-2 shrink-0">
                {/* Copy */}
                <button
                  onClick={() => copyLink(link.token)}
                  aria-label={`Copy link for ${link.label}`}
                  className="inline-flex items-center gap-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground border border-border hover:border-foreground/30 hover:text-foreground px-3 h-9 transition-all"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(link)}
                  aria-label={`${link.is_active ? 'Deactivate' : 'Activate'} ${link.label}`}
                  className="inline-flex items-center gap-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground border border-border hover:border-foreground/30 hover:text-foreground px-3 h-9 transition-all"
                >
                  {link.is_active
                    ? <><ToggleRight className="h-4 w-4 text-admitted" />Deactivate</>
                    : <><ToggleLeft className="h-4 w-4" />Activate</>
                  }
                </button>
                {/* Delete */}
                <button
                  onClick={() => setDeleteTarget(link)}
                  aria-label={`Delete scanner link ${link.label}`}
                  className="inline-flex items-center justify-center font-sans text-[10px] font-semibold uppercase text-destructive/60 border border-destructive/20 hover:border-destructive/50 hover:text-destructive hover:bg-destructive/[0.06] px-3 h-9 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info panel */}
      <div className="mt-8 border-l-2 border-copper bg-copper/[0.06] p-5">
        <p className="font-sans text-xs text-foreground/70 leading-relaxed">
          <span className="font-semibold text-copper">How to use:</span>{' '}
          Copy a link and send it to your usher via WhatsApp or SMS.
          They open it on their phone browser — no app download, no login required.
          The link only works for this event.
        </p>
      </div>

      {/* Delete link confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="DELETE_LINK"
        description="THIS_ACTION_IS_IRREVERSIBLE"
        subject={deleteTarget?.label}
        subjectLabel="TARGET_LINK"
        body="Deleting this link will immediately revoke usher access. Any usher using this link will be blocked from scanning."
        confirmLabel="DELETE_LINK"
        isPending={isDeleting}
        onConfirm={() => {
          if (!deleteTarget) return
          startDeleteTransition(async () => {
            const result = await deleteScannerLink(deleteTarget.id, eventId)
            if (result?.error) toast.error(result.error)
            else { toast.success('Link deleted'); loadLinks(); setDeleteTarget(null) }
          })
        }}
      />
    </div>
  )
}
