import { getCategories } from '@/services/categories.service'
import { AdminTeachersPanel } from '@/components/admin/admin-teachers-panel'

export default async function AdminTeachersPage() {
  const categories = await getCategories()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Giełda i nauczyciele</h1>
        <p className="text-sm text-muted-foreground">Zarządzaj wszystkimi profilami nauczycieli — akceptuj, odrzucaj, wyróżniaj lub usuwaj.</p>
      </div>
      <AdminTeachersPanel categories={categories} />
    </div>
  )
}
