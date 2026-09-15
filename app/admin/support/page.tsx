import { AdminSupportMessagesPanel } from '@/components/admin/admin-support-messages-panel'

export default function AdminSupportPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Support</h1>
        <p className="text-sm text-muted-foreground">Wiadomości wysłane przez formularz kontaktowy na stronie.</p>
      </div>
      <AdminSupportMessagesPanel />
    </div>
  )
}
