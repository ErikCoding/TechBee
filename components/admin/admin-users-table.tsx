'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
  { value: 'admin', label: 'Administratorzy' },
]

export function AdminUsersTable({ users }: AdminUsersTableProps) {
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<AdminUserRow['role'] | 'all'>('all')

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesRole = roleFilter === 'all' || u.role === roleFilter
      const matchesQuery = !query.trim() || u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase())
      return matchesRole && matchesQuery
    })
  }, [users, query, roleFilter])

  return (
    <div id="users" className="rounded-2xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj po nazwisku lub e-mailu..." className="pl-9" aria-label="Szukaj użytkowników" />
        </div>
        <div className="flex flex-wrap gap-1.5">
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
              return (
                <tr key={u.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback color={u.avatarColor} className="text-[11px]">{u.initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
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
