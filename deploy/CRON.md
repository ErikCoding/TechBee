# Runbee: harmonogram cron (konfiguracja do wdrożenia)

Stan repo: brak `vercel.json`, brak `.github/workflows`, brak innej konfiguracji
schedulera. To jest przygotowana konfiguracja, żadna zmiana produkcyjna nie została
wykonana. Zanim zadziała, ustaw `CRON_SECRET` (długi losowy ciąg, np. `openssl rand -hex 32`)
w zmiennych środowiskowych produkcji.

Wszystkie trzy endpointy: `GET`, nagłówek `Authorization: Bearer <CRON_SECRET>`.
Bez sekretu zwracają 503, ze złym 401. Każdy jest ograniczony do jednej paczki rekordów
i bezpieczny przy nakładających się wywołaniach.

| Endpoint | Harmonogram | Do czego |
|---|---|---|
| `/api/cron/auto-confirm-reports` | `0 * * * *` (co godzinę) | auto-potwierdzenie raportów po terminie, uwolnienie środków |
| `/api/cron/lesson-reminders` | `0 * * * *` (co godzinę) | przypomnienie dla lekcji startujących w ciągu najbliższych 24 h. Idzie przy pierwszym przebiegu po wejściu w to okno, więc przerwa w cronie opóźnia mail, ale go nie gubi (póki lekcja się nie zaczęła). Lekcja zarezerwowana na mniej niż 24 h przed startem dostaje przypomnienie od razu. |
| `/api/cron/email-outbox` | `*/10 * * * *` (co 10 min) | ponawianie maili pending/failed/sending, wygaszanie nieaktualnych |

## Opcja A: Vercel Cron (wymaga planu Pro, bo Hobby dopuszcza tylko cron raz dziennie)

Vercel sam dołącza `Authorization: Bearer $CRON_SECRET`, gdy zmienna `CRON_SECRET` jest ustawiona w projekcie.
Plik `vercel.json` w katalogu głównym:

```json
{
  "crons": [
    { "path": "/api/cron/auto-confirm-reports", "schedule": "0 * * * *" },
    { "path": "/api/cron/lesson-reminders", "schedule": "0 * * * *" },
    { "path": "/api/cron/email-outbox", "schedule": "*/10 * * * *" }
  ]
}
```

Na planie Hobby takie wyrażenia odrzuci deploy. Użyj wtedy opcji B.

## Opcja B: GitHub Actions (działa niezależnie od hostingu)

Sekrety repo: `CRON_SECRET` i `APP_URL` (np. `https://runbee.pl`, bez końcowego `/`).
Plik `.github/workflows/runbee-cron.yml`:

```yaml
name: runbee-cron
on:
  schedule:
    - cron: '*/10 * * * *'   # outbox
    - cron: '0 * * * *'      # reminders + auto-confirm
  workflow_dispatch: {}
jobs:
  call:
    runs-on: ubuntu-latest
    steps:
      - name: Outbox (every run)
        run: curl -fsS --max-time 60 -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" "${{ secrets.APP_URL }}/api/cron/email-outbox"
      - name: Hourly jobs (only on the full hour)
        if: github.event.schedule == '0 * * * *' || github.event_name == 'workflow_dispatch'
        run: |
          curl -fsS --max-time 60 -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" "${{ secrets.APP_URL }}/api/cron/auto-confirm-reports"
          curl -fsS --max-time 60 -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" "${{ secrets.APP_URL }}/api/cron/lesson-reminders"
```

GitHub potrafi opóźniać zaplanowane uruchomienia o kilka minut, co jest akceptowalne dla tych zadań.

## Weryfikacja po włączeniu (staging lub produkcja, bez wysyłania maili)

```sh
curl -i  "$APP_URL/api/cron/email-outbox"                                   # oczekiwane 401
curl -is -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/email-outbox"   # 200 + {"scanned":..,"retried":..}
```

Przy pustym outboxie odpowiedź to same zera. Pierwsze wywołanie `lesson-reminders` i `auto-confirm-reports`
może wysłać prawdziwe maile istniejącym użytkownikom, jeśli są lekcje w oknie, więc uruchom je najpierw na stagingu.
