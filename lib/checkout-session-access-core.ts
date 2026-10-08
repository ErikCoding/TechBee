export type CheckoutAccessSubject = {
  studentId?: string | null
  payerId?: string | null
}

export type CheckoutAccessViewer = {
  uid: string
  role?: string | null
  linkedParentIds?: string[] | null
}

export function canAccessCheckoutSubject(subject: CheckoutAccessSubject, viewer: CheckoutAccessViewer): boolean {
  if (!subject.studentId) return false
  if (viewer.role === 'admin') return true
  if (viewer.uid === subject.studentId || viewer.uid === subject.payerId) return true
  return Boolean(viewer.linkedParentIds?.includes(viewer.uid))
}

