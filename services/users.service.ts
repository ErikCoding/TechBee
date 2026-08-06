// ─────────────────────────────────────────────────────────────
// Data-access layer for the authenticated user / profile.
// There is no auth yet — this returns a fixed mock "current user"
// so pages can be written against a real interface from day one.
// Once Firebase Auth is wired up, `getCurrentUser` will read from
// the auth session and `users/{uid}` in Firestore.
// ─────────────────────────────────────────────────────────────

export type CurrentUser = {
  id: string
  name: string
  firstName: string
  initials: string
  avatarColor: string
  role: 'student' | 'teacher' | 'admin'
  email: string
}

const mockCurrentStudent: CurrentUser = {
  id: 'u3',
  name: 'Filip Nowicki',
  firstName: 'Filip',
  initials: 'FN',
  avatarColor: '#8B5CF6',
  role: 'student',
  email: 'filip.nowicki@example.com',
}

export async function getCurrentUser(): Promise<CurrentUser> {
  // TODO(firebase): read from Firebase Auth (onAuthStateChanged) + Firestore `users/{uid}`
  return mockCurrentStudent
}
