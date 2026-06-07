import type { Metadata } from 'next'
import { getEventAccess } from '@/lib/team-access'
import ScannerLinksClient from './scanner-links-client'

export const metadata: Metadata = { title: 'Scanner Links' }

export default async function ScannerLinksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await getEventAccess(id)
  return <ScannerLinksClient canManage={access.canManageScanners} />
}
