'use client'

import { Globe2, Plus, Trash2 } from 'lucide-react'
import styles from './teacher-application-form.module.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { normalizeIntervals } from '@/lib/availability-core'
import type { AvailabilityHours, AvailabilityInterval, WeekdayCode } from '@/lib/types'

const DAYS: [WeekdayCode, string][] = [
  ['Mon', 'Poniedziałek'], ['Tue', 'Wtorek'], ['Wed', 'Środa'], ['Thu', 'Czwartek'],
  ['Fri', 'Piątek'], ['Sat', 'Sobota'], ['Sun', 'Niedziela'],
]

export function AvailabilityEditor({ activeDays, hours, fallback, onDaysChange, onHoursChange }: {
  activeDays: string[]
  hours: AvailabilityHours
  fallback: AvailabilityInterval
  onDaysChange: (days: string[]) => void
  onHoursChange: (hours: AvailabilityHours) => void
}) {
  function save(day: WeekdayCode, intervals: AvailabilityInterval[]) {
    onHoursChange({ ...hours, [day]: { ...intervals[0], intervals } })
  }
  return (
    <div className={styles.schedule}>
      <div className={styles.scheduleHeader}><span><Globe2 size={14} aria-hidden="true" />Europe/Warsaw</span><span>{activeDays.length} z 7 dni</span></div>
      {DAYS.map(([day, label]) => {
        const active = activeDays.includes(day)
        const entry = hours[day]
        const intervals = entry?.intervals ?? [entry ?? fallback]
        let error = ''
        try { normalizeIntervals(intervals) } catch (reason) { error = reason instanceof Error ? reason.message : 'Sprawdź godziny.' }
        return (
          <fieldset key={day} data-active={active} className={styles.day} onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node)) return
            if (!error) save(day, normalizeIntervals(intervals))
          }}>
            <legend className="sr-only">{label}</legend>
            <div className={styles.dayGrid}>
              <div className={styles.dayIdentity}>
                <span>{label}</span>
                <label className={styles.dayToggle}>
                  <Switch checked={active} onCheckedChange={(checked) => onDaysChange(checked ? [...activeDays, day] : activeDays.filter((d) => d !== day))} aria-label={`${label}: dostępność`} />
                  {active ? 'Dostępny' : 'Wyłączony'}
                </label>
              </div>
              <div className={styles.dayContent}>
                {!active ? <p className={styles.unavailable}>Bez rezerwacji w tym dniu</p> : <>
                  {intervals.map((range, index) => (
                    <div key={index} className={styles.interval}>
                      {(['start', 'end'] as const).map((field) => (
                        <label key={field} style={field === 'end' ? { gridColumn: 3 } : undefined}>
                          {field === 'start' ? 'Od' : 'Do'}
                          <Input type="time" step={60} required value={range[field]} aria-label={`${label}, przedział ${index + 1}, ${field === 'start' ? 'od' : 'do'}`} aria-invalid={Boolean(error)} aria-describedby={error ? `hours-error-${day}` : undefined}
                            className="h-11 min-w-0 w-full md:h-11"
                            onChange={(e) => save(day, intervals.map((item, i) => i === index ? { ...item, [field]: e.target.value } : item))} />
                        </label>
                      ))}
                      <span aria-hidden="true" style={{ gridColumn: 2, gridRow: 1 }}>–</span>
                      <Button type="button" variant="ghost" className={styles.removeInterval} title={`Usuń przedział ${index + 1}: ${label}`} aria-label={`Usuń przedział ${index + 1}: ${label}`}
                        onClick={() => intervals.length === 1 ? onDaysChange(activeDays.filter((d) => d !== day)) : save(day, intervals.filter((_, i) => i !== index))}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                  {error && <p id={`hours-error-${day}`} role="status" className={styles.scheduleError}>{error}</p>}
                  <Button type="button" variant="ghost" className={styles.addInterval} onClick={() => save(day, [...intervals, { start: '', end: '' }])}>
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />Dodaj przedział
                  </Button>
                </>}
              </div>
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
