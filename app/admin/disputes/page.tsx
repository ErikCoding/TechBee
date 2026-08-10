import { AdminDisputesPanel } from '@/components/admin/admin-disputes-panel'

export default function AdminDisputesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Spory</h1>
        <p className="text-sm text-muted-foreground">Raporty lekcji zakwestionowane przez ucznia lub rodzica — rozstrzygnij na czyją korzyść zwolnić zablokowaną płatność.</p>
      </div>
      <AdminDisputesPanel />
    </div>
  )
}
