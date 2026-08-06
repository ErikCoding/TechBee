import { getAdminUsers } from '@/services/admin.service'
import { AdminUsersTable } from '@/components/admin/admin-users-table'

export default async function AdminUsersPage() {
  const users = await getAdminUsers()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Użytkownicy</h1>
        <p className="text-sm text-muted-foreground">Wszystkie konta na platformie.</p>
      </div>
      <AdminUsersTable users={users} />
    </div>
  )
}
