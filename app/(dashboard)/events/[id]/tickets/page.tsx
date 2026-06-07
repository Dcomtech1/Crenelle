import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getEventAccess } from '@/lib/team-access'
import TicketsPageClient from './tickets-client'

export const metadata: Metadata = { title: 'Tickets' }

export default async function TicketsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const access = await getEventAccess(id)

  if (!access.role) {
    notFound()
  }

  return <TicketsPageClient canEdit={access.canEdit} />
}
