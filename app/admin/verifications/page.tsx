import { AdminVerificationsPanel } from '@/components/admin/admin-verifications-panel'

export default function AdminVerificationsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Weryfikacje</h1>
        <p className="text-sm text-muted-foreground">Nowe zgłoszenia nauczycieli czekające na akceptację przed pojawieniem się w giełdzie.</p>
      </div>
      <AdminVerificationsPanel />
    </div>
  )
}
