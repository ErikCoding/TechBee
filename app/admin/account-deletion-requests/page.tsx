import { AdminAccountDeletionRequestsPanel } from '@/components/admin/admin-account-deletion-requests-panel'

export default function AdminAccountDeletionRequestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bezpieczeństwo danych</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Żądania usunięcia kont</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Przeglądaj żądania użytkowników, blokady rozliczeniowe i historię decyzji administratorów.
        </p>
      </div>
      <AdminAccountDeletionRequestsPanel />
    </div>
  )
}
