import { getEventAccess } from '@/lib/team-access'
import ScannerLinksClient from './scanner-links-client'

export default async function ScannerLinksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await getEventAccess(id)
  return <ScannerLinksClient canManage={access.canManageScanners} />
}
