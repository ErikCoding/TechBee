import { AdminSeedPanel } from '@/components/admin/admin-seed-panel'

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Ustawienia</h1>
        <p className="text-sm text-muted-foreground">Konfiguracja danych i integracji.</p>
      </div>
      <AdminSeedPanel />
    </div>
  )
}
