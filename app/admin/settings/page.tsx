import { AdminSeedPanel } from '@/components/admin/admin-seed-panel'
import { AdminSandboxResetPanel } from '@/components/admin/admin-sandbox-reset-panel'
import { AdminChatCleanupPanel } from '@/components/admin/admin-chat-cleanup-panel'
import { AdminResetPanel } from '@/components/admin/admin-reset-panel'

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Ustawienia</h1>
        <p className="text-sm text-muted-foreground">Konfiguracja danych i integracji.</p>
      </div>
      <AdminSeedPanel />
      <AdminSandboxResetPanel />
      <AdminChatCleanupPanel />
      <AdminResetPanel />
    </div>
  )
}
