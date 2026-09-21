import { AdminFoundingTeachersPanel } from '@/components/admin/admin-founding-teachers-panel'

export const dynamic = 'force-dynamic'

export default function AdminFoundingTeachersPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Pierwsza 50</h1>
        <p className="text-sm text-muted-foreground">Program promocyjny dla pierwszych nauczycieli Runbee.</p>
      </div>
      <AdminFoundingTeachersPanel />
    </div>
  )
}
