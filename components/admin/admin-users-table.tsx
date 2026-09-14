'use client'

import { useMemo, useState } from 'react'
import { ArrowDownUp, Search, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { AdminUserRow } from '@/lib/types'

interface AdminUsersTableProps {
  users: AdminUserRow[]
}

const roleLabels: Record<AdminUserRow['role'], string> = {
  student: 'Uczeń',
  teacher: 'Nauczyciel',
  admin: 'Administrator',
  parent: 'Rodzic',
}

const statusConfig: Record<AdminUserRow['status'], { label: string; tone: StatusTone }> = {
  active: { label: 'Aktywny', tone: 'success' },
  pending: { label: 'Oczekuje', tone: 'warning' },
  suspended: { label: 'Zawieszony', tone: 'error' },
}

const roleFilters: { value: AdminUserRow['role'] | 'all'; label: string }[] = [
  { value: 'all', label: 'Wszyscy' },
  { value: 'student', label: 'Uczniowie' },
  { value: 'teacher', label: 'Nauczyciele' },
  { value: 'parent', label: 'Rodzice' },
  { value: 'admin', label: 'Administratorzy' },
]

const sortOptions = [
  { value: 'newest', label: 'Najnowsi pierwsi' },
  { value: 'oldest', label: 'Najstarsi pierwsi' },
  { value: 'name', label: 'A-Z nazwisko' },
  { value: 'role', label: 'Rola' },
  { value: 'lessons', label: 'Najwięcej lekcji' },
] as const

type SortMode = (typeof sortOptions)[number]['value']

const NEW_USER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function isNewUser(user: AdminUserRow): boolean {
  return Boolean(user.createdAt && Date.now() - user.createdAt <= NEW_USER_WINDOW_MS)
}

export function AdminUsersTable({ users }: AdminUsersTableProps) {
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<AdminUserRow['role'] | 'all'>('all')
  const [sortMode, setSortMode] = useState<SortMode>('newest')

  const filtered = useMemo(() => {
    const scoped = users.filter((u) => {
      const matchesRole = roleFilter === 'all' || u.role === roleFilter
      const matchesQuery = !query.trim() || u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase())
      return matchesRole && matchesQuery
    })
    return [...scoped].sort((a, b) => {
      if (sortMode === 'oldest') return (a.createdAt ?? 0) - (b.createdAt ?? 0)
      if (sortMode === 'name') return a.name.localeCompare(b.name, 'pl')
      if (sortMode === 'role') return roleLabels[a.role].localeCompare(roleLabels[b.role], 'pl') || a.name.localeCompare(b.name, 'pl')
      if (sortMode === 'lessons') return b.lessons - a.lessons || a.name.localeCompare(b.name, 'pl')
      return (b.createdAt ?? 0) - (a.createdAt ?? 0)
    })
  }, [users, query, roleFilter, sortMode])

  const newUsersCount = useMemo(() => users.filter(isNewUser).length, [users])

  return (
    <div id="users" className="rounded-2xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj po nazwisku lub e-mailu..." className="pl-9" aria-label="Szukaj użytkowników" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{filtered.length} z {users.length} kont</span>
            {newUsersCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-foreground">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Nowi: {newUsersCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" />
            Kolejność
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap justify-start gap-1.5 sm:justify-end">
            {roleFilters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setRoleFilter(f.value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  roleFilter === f.value
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Użytkownik</th>
              <th className="px-4 py-3 font-medium">Rola</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Dołączył</th>
              <th className="px-4 py-3 text-right font-medium">Lekcje</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const status = statusConfig[u.status]
              const newUser = isNewUser(u)
              return (
                <tr
                  key={u.id}
                  className={cn(
                    'border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40',
                    newUser && 'bg-accent/45 hover:bg-accent/60',
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        {u.photoUrl && <AvatarImage src={u.photoUrl} alt="" />}
                        <AvatarFallback color={u.avatarColor} className="text-[11px]">{u.initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
                          {newUser && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                              <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                              Nowy
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{roleLabels[u.role]}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={status.tone} dot={false} className="text-[11px]">
                      {status.label}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.joined}</td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-foreground">{u.lessons.toLocaleString('pl-PL')}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Brak użytkowników pasujących do filtrów.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
