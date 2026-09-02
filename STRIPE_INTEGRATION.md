# Integracja Stripe Connect — podsumowanie

Prawdziwe płatności (Stripe Test Mode) za lekcje, wypłaty dla nauczycieli przez Stripe Connect, **bez portfela ucznia**. Stripe jest źródłem prawdy dla realnych pieniędzy — Firestore przechowuje tylko ID/statusy/kwoty historyczne.

## 1. Architektura — najważniejsza decyzja do zaakceptowania

Twój szkic flow zakładał: uczeń wybiera termin → płaci → rezerwacja od razu potwierdzona. W Runbee istniał już jednak działający, celowy mechanizm: nauczyciel musi zaakceptować/odrzucić każdą prośbę o rezerwację (np. konflikt w kalendarzu). Nie chciałem tego wyrzucać bez pytania, więc połączyłem oba wymagania:

1. Uczeń płaci **od razu** przy rezerwacji (Stripe Checkout) — pieniądze trafiają na saldo Runbee na Stripe.
2. Rezerwacja (dokument `Lesson`) **powstaje dopiero, gdy webhook potwierdzi udaną płatność** — nigdy wcześniej, nigdy po stronie klienta.
3. Nauczyciel nadal akceptuje/odrzuca — odrzucenie **automatycznie** wykonuje prawdziwy zwrot Stripe.
4. Wypłata do nauczyciela (prawdziwy `Transfer`) następuje dopiero po potwierdzeniu raportu z lekcji — dokładnie tak jak wcześniej działał depozyt w portfelu, tylko teraz to realny Stripe Transfer zamiast zapisu w Firestore.

Efekt: `paymentStatus` (paid/refunded/failed) to nowe pole obok istniejącego `status` (pending/upcoming/completed/cancelled) — nie zastąpiłem `status`, bo cała reszta UI (dashboardy, powiadomienia) już go używa. To odpowiada Twojemu `bookingStatus`, tylko bez masowego przepisywania działającego kodu.

## 2. Brak trusted backendu → jedna nowa zmienna env

Projekt jawnie wyłączył `firebase-admin` wcześniej (bug `jose`/`jwks-rsa` przy buildzie na Vercelu — patrz stary komentarz w `lib/firebase-admin.ts`). Webhook Stripe **musi jednak** zapisywać status płatności w sposób niemożliwy do sfałszowania z przeglądarki. Rozwiązanie: importuję **wyłącznie** `firebase-admin/app` + `firebase-admin/firestore` (nigdy `firebase-admin/auth`, który powodował błąd) — zweryfikowałem to bezpośrednio (`require()` tych dwóch modułów nigdy nie dotyka `jose`/`jwks-rsa`). Weryfikacja tożsamości użytkownika w endpointach nadal idzie przez to samo REST API Google, którego już używa `app/api/livekit/token`.

To dodaje jedną nową zmienną: `FIREBASE_SERVICE_ACCOUNT_KEY`.

## 3. Stripe Connect — typ konta

Express (nie Standard/Custom) z jedną capability: `transfers` (nie `card_payments` — nauczyciel nigdy nie przyjmuje płatności bezpośrednio). Wzorzec pieniędzy: **Separate Charges and Transfers** — płatność ucznia ląduje na koncie platformy, realny `Transfer` do nauczyciela następuje dopiero po potwierdzeniu raportu. Konta tworzone z ręcznym harmonogramem wypłat (`payouts.schedule.interval: 'manual'`), żeby przycisk „Wypłać” faktycznie coś robił, zamiast Stripe wypłacał automatycznie w tle.

## 4. Zmienione/nowe pliki

**Nowe (Stripe core):** `lib/stripe.ts`, `lib/stripe-config.ts`, `lib/stripe-server-auth.ts`, `lib/request-origin.ts`, `services/stripe.service.ts`

**Nowe (API routes):** `app/api/stripe/connect/onboard`, `app/api/stripe/connect/status`, `app/api/stripe/checkout/create-session`, `app/api/stripe/checkout/status`, `app/api/stripe/webhook`, `app/api/stripe/lessons/[lessonId]/transfer`, `app/api/stripe/lessons/[lessonId]/refund`, `app/api/stripe/wallet`, `app/api/stripe/payout`

**Nowe (UI):** `components/dashboard/teacher-stripe-connect-card.tsx`, `components/wallet/teacher-wallet-client.tsx`, `components/payment/payment-success-client.tsx`, `app/payment/success/page.tsx`

**Przepisane:** `lib/firebase-admin.ts` (bezpieczny trusted backend), `lib/types.ts` (pola płatności na `Lesson`, `TeacherStripeAccount`, `PayoutRecord`, `TeacherWalletSummary`), `lib/firebase.ts` (nowe kolekcje), `firestore.rules` (pola płatności niemożliwe do nadpisania przez klienta, brak tworzenia `lessons` przez klienta), `services/lessons.service.ts` (Transfer/Refund zamiast portfela), `components/teacher/teacher-booking-calendar.tsx` (Stripe Checkout zamiast rezerwacji lokalnej), `app/wallet/page.tsx` (tylko nauczyciel, dane ze Stripe), `components/layout/navbar.tsx` (link „Portfel” tylko dla nauczyciela)

**Usunięte (portfel ucznia — zgodnie z instrukcją):** `services/wallet.service.ts`, `components/wallet/wallet-client.tsx`, `components/dashboard/wallet-balance-link.tsx`, `data/wallet.data.ts`, typy `WalletStats`/`Transaction`

## 5. Nowe zmienne `.env` (patrz `.env.example`)

```env
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
FIREBASE_SERVICE_ACCOUNT_KEY=
```

Żadna istniejąca zmienna nie została usunięta.

## 6. Konfiguracja Stripe Dashboard

1. Załóż konto na [dashboard.stripe.com](https://dashboard.stripe.com), włącz **Test mode** (przełącznik w prawym górnym rogu).
2. **Connect → Settings** → włącz Connect, typ platformy: *Platform or marketplace*.
3. **Developers → API keys** → skopiuj `Secret key` i `Publishable key` do `.env.local`.
4. **Firebase Console → Project settings → Service accounts** → *Generate new private key* → wklej całą zawartość JSON jako jedną linię do `FIREBASE_SERVICE_ACCOUNT_KEY`.

## 7. Lokalne testowanie webhooka

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Skopiuj wypisany `whsec_...` do `STRIPE_WEBHOOK_SECRET`. Po wdrożeniu produkcyjnym dodaj webhook w **Developers → Webhooks** wskazujący na `https://twoja-domena/api/stripe/webhook`, nasłuchujący co najmniej: `checkout.session.completed`, `charge.refunded`, `payout.paid`, `payout.failed`, `account.updated`.

## 8. Testowanie płatności

Karta testowa sukcesu: `4242 4242 4242 4242`, dowolna przyszła data, dowolny CVC. Karta odrzucenia: `4000 0000 0000 0002`.

**Ważne przy testowaniu całego flow (płatność → raport → potwierdzenie) pod rząd:** zwykła karta `4242...` w Stripe Test Mode ląduje na saldzie platformy jako *pending*, nie *available* — a `Transfer` do nauczyciela (zwolnienie płatności po potwierdzeniu raportu) może korzystać tylko z salda *available*. Jeśli przetestujesz cały flow w kilka minut, potwierdzenie raportu skończy się błędem Stripe `balance_insufficient`. Żeby to obejść w Test Mode, zapłać za lekcję kartą `4000 0000 0000 0077` — ląduje od razu na saldzie *available*, więc `Transfer` przy potwierdzeniu zadziała natychmiast. (Na produkcji, na prawdziwych płatnościach, to nie występuje — środki po prostu stają się dostępne po standardowym okresie rozliczeniowym Stripe.)

## 9. Scenariusze do ręcznego przetestowania

**A — happy path z wypłatą:** zarejestruj nauczyciela → w panelu nauczyciela „Skonfiguruj wypłaty” → onboarding Stripe (dane testowe) → zaloguj się jako uczeń, zarezerwuj lekcję → zapłać kartą `4242...` → sprawdź: rezerwacja pojawia się u nauczyciela jako „Zapytania o lekcje” → zaakceptuj → odbądźcie/zakończcie lekcję → nauczyciel wysyła raport (karta na czacie) → uczeń potwierdza → sprawdź w `/wallet` nauczyciela, że „Dostępne środki” wzrosło → kliknij „Wypłać środki”.

**B — nieudana płatność:** przy płatności użyj karty `4000 0000 0000 0002` → Stripe odrzuci → nie powinna powstać żadna rezerwacja (bo webhook nigdy nie dostanie `checkout.session.completed`) → uczeń wraca na stronę rezerwacji.

**C — refund:** zarezerwuj i zapłać lekcję → jako nauczyciel odrzuć prośbę o rezerwację → sprawdź w Stripe Dashboard (Payments), że płatność ma status *Refunded* → `paymentStatus` lekcji w Firestore to `refunded`.

## Aktualizacja — Stripe zablokował tworzenie kont Connect przez Accounts v1

Po wdrożeniu, klikając „Skonfiguruj wypłaty”, dostałeś błąd: *"Stripe no longer recommends Accounts v1 for new Connect integrations."* Sprawdziłem aktualną dokumentację Stripe (nie zgadywałem) — to nie jest błąd konfiguracji, tylko realna zmiana: Stripe blokuje teraz domyślnie tworzenie kont przez `/v1/accounts` dla nowych platform Connect i każe używać **Accounts v2** (`/v2/core/accounts`). Zgodnie z Twoją instrukcją nie włączyłem starego trybu v1 w Dashboardzie — zamiast tego przepisałem tworzenie konta na v2.

Co się zmieniło:

- **`app/api/stripe/connect/onboard/route.ts`** — tworzenie konta: zamiast `stripe.accounts.create({ type: 'express', capabilities: {transfers}, business_type: ... })` (v1) jest teraz `stripe.v2.core.accounts.create({ dashboard: 'express', configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: {...} } } } }, defaults: { responsibilities: {...} } })` (v2). Konto nadal jest typu Express (`dashboard: 'express'`) i nadal może tylko *odbierać* przelewy, nigdy przyjmować płatności bezpośrednio — to się nie zmieniło, zmienił się tylko kształt wywołania API. Link do onboardingu Stripe (Account Link) też przeszedł na endpoint v2, bo v1 nie rozumie konfiguracji `recipient`.
- **`app/api/stripe/connect/status/route.ts`** — sprawdzanie statusu konta też przeszło na `stripe.v2.core.accounts.retrieve(...)`, bo v2 zwraca status w innym kształcie (per-capability status zamiast pól typu `details_submitted`/`charges_enabled`).
- **`app/api/stripe/webhook/route.ts`** — `handleAccountUpdated` (event `account.updated`) jest teraz no-opem tylko z logowaniem. To zdarzenie pochodzi z API v1 i po migracji na konta v2 nie ma gwarancji, że odda poprawny status — a błędny zapis mógłby cofnąć poprawnie zweryfikowanego nauczyciela z powrotem na „niedokończone”. Realnym źródłem prawdy zostaje `status/route.ts`, wywoływane przy każdym wejściu na dashboard nauczyciela i zaraz po powrocie z onboardingu Stripe — więc nic funkcjonalnie nie ucierpiało.
- **Wypłaty, przelewy, zwroty, saldo** (`app/api/stripe/payout`, `.../lessons/[id]/transfer`, `.../lessons/[id]/refund`, `app/api/stripe/wallet`) — bez zmian. To są operacje na koncie (Balance/Payouts/Transfers z parametrem `stripeAccount`), a nie odczyt obiektu Account, więc działają identycznie niezależnie od tego, czy konto powstało przez v1 czy v2.

`npx tsc --noEmit` przechodzi czysto po tych zmianach. Sprawdziłem też Twój `FIREBASE_SERVICE_ACCOUNT_KEY` — jest teraz poprawnym, pełnym JSON-em service accounta (nie samym kluczem), więc trusted backend powinien działać.

## Aktualizacja 2 — "Dokończ konfigurację" nie znikało mimo ukończonej weryfikacji

Prawdziwa przyczyna: konto Stripe potrzebuje **dwóch** rzeczy, żeby przycisk „Wypłać” działał — capability `stripe_transfers` (odbieranie przelewów od platformy) i capability `payouts` (wypłata z salda Stripe na konto bankowe). Ta druga jest sklasyfikowana przez Stripe jako wymóg „eventually due” (potrzebny później, nie od razu) — domyślnie hostowany formularz Stripe zbiera tylko to, co jest „currently due”, więc nauczyciel kończył weryfikację, ale numer konta bankowego nigdy nie był o niego proszony, i `payouts` zostawało w statusie `pending` na zawsze.

Naprawiłem to w `app/api/stripe/connect/onboard/route.ts` — link do onboardingu teraz jawnie prosi też o wymogi „eventually due” (`collection_options: { fields: 'eventually_due', future_requirements: 'include' }`), więc formularz Stripe zbiera numer konta bankowego w tej samej sesji, zamiast wymagać drugiego podejścia.

**To wymaga ponownego kliknięcia „Dokończ konfigurację”** — istniejące konto zostanie zachowane, ale nowy link do onboardingu poprosi Cię tym razem też o dane konta bankowego.

## Ograniczenie weryfikacji w tej sesji

`npx tsc --noEmit` przechodzi czysto. Pełnego `next build` **nie udało się** przeprowadzić w tym środowisku — sandbox blokuje połączenie z `fonts.googleapis.com` (używane przez `next/font` w `app/layout.tsx`), co jest ograniczeniem sieciowym niezwiązanym z tą zmianą (ten sam błąd wystąpiłby na nietkniętym kodzie). Zdecydowanie polecam uruchomić `npm run build` lokalnie przed wdrożeniem — to jedyny krok weryfikacji, którego nie mogłem wykonać sam.
