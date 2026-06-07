import type { Metadata } from 'next'
import { getEventAccess } from '@/lib/team-access'
import GuestsPageClient from './guests-client'

export const metadata: Metadata = { title: 'Guests' }

export default async function GuestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await getEventAccess(id)
  return <GuestsPageClient canEdit={access.canManageGuests} />
}
