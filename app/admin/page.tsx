import { getAdminStats } from '@/services/admin.service'
import { AdminOverviewClient } from '@/components/admin/admin-overview-client'

export default async function AdminPage() {
  const stats = await getAdminStats()
  return <AdminOverviewClient initialStats={stats} />
}
