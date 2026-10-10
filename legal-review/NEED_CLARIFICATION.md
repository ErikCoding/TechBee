# Runbee: punkty do decyzji operatora i przeglądu prawnego

Regulamin (`/terms`), Polityka prywatności (`/privacy`) i Polityka cookies (`/cookies`) zostały
przepisane na podstawie rzeczywistego kodu platformy (stan 10.10.2026). Nie zawierają
placeholderów, ale pewnych faktów nie dało się ustalić z repozytorium. Poniższe punkty
trzeba rozstrzygnąć **przed publikacją**. Dokumenty nie zostały wdrożone.

## A. Dane, których brakuje w źródłach

| # | Pytanie | Gdzie to dotyczy |
|---|---|---|
| A1 | Czy Operator prowadzi zarejestrowaną działalność? Jeśli tak: firma, NIP, REGON, adres siedziby lub do doręczeń. W dokumentach jest tylko „Bartosz Prokop” i `kontakt@runbee.pl` (tak było już w starym Regulaminie). | Regulamin §1, Polityka pkt 1 |
| A2 | Czy wystawiacie faktury/rachunki za opłatę serwisową i prowizję? Czy VAT dotyczy tych opłat? | Regulamin §7, Polityka pkt 6 |
| A3 | Okres przechowywania: stary tekst podawał „co do zasady 5 lat od końca roku podatkowego” dla dokumentacji rozliczeniowej, więc go zachowano. Do potwierdzenia przez księgowego. | Polityka pkt 6 |
| A4 | Konkretne okresy dla: Lekcji, Raportów i sporów po usunięciu konta (dziś: „do przedawnienia roszczeń”), zgłoszeń z formularza kontaktowego, logów bezpieczeństwa, zdarzeń Stripe. | Polityka pkt 6 |
| A5 | Minimalny wiek Ucznia i zasady zgody opiekuna dla małoletnich. Dokumenty tego nie regulują (w kodzie nie ma weryfikacji wieku). | Regulamin §3 |
| A6 | Polityka anulowania: w kodzie nie ma terminów (np. „do 24 h przed Lekcją”). Regulamin mówi tylko o prośbie i akceptacji drugiej strony. Czy chcecie sztywne terminy? | Regulamin §5 ust. 4, §7 ust. 6 |
| A7 | Prowizja Nauczyciela: kod ma 8% jako wartość awaryjną, a faktyczna jest w ustawieniach płatności (admin). Program „Pierwsza 50” ma domyślnie 5% przez 90 dni, ale jest wyłączony. Regulamin odsyła do panelu Nauczyciela. Czy podać liczby w Regulaminie? | Regulamin §7 ust. 4 |
| A8 | Obowiązki podatkowe Nauczycieli i obowiązki sprawozdawcze platformy (np. DAC7). Nie ma ich w tekście, bo nie wynikają z kodu. | Regulamin §7 |
| A9 | Zgoda konsumenta na rozpoczęcie wykonania usługi przed upływem 14 dni (art. 38 pkt 1 ustawy o prawach konsumenta): w kodzie checkoutu nie znalazłem pola tej zgody, więc Regulamin §13 ust. 2 opisuje zasadę, której płatność dziś nie potwierdza. Do decyzji: dodać zgodę w checkoutcie albo zmienić zapis. | Regulamin §13 |

## B. Fakty techniczne do potwierdzenia

| # | Co sprawdzić | Dlaczego |
|---|---|---|
| B1 | Brak nagrywania w LiveKit Cloud (egress/recording wyłączone). W kodzie nie ma żadnego nagrywania, a Regulamin §2 ust. 3 i Polityka pkt 2 mówią „nie nagrywamy”. | Twierdzenie w dokumentach |
| B2 | Hosting aplikacji (Vercel?) i regiony usług (Firestore, Storage, Resend, LiveKit). Polityka wymienia Vercel tylko dla statystyk i dopisuje „dostawcę hostingu”. | Odbiorcy i transfery poza EOG (pkt 4–5) |
| B3 | Podpisane umowy powierzenia (DPA) i mechanizmy transferu z Google, Stripe, Resend, LiveKit, Vercel. | Polityka pkt 4–5 |
| B4 | Czy Vercel Analytics wymaga zgody (cookie/ePrivacy) według oceny prawnej. Obecnie ładuje się bez banera i Polityka cookies opisuje je jako niewymagające cookies. Stara wersja pisała o analityce „po zgodzie”, czego kod nie robi. | Polityka cookies |
| B5 | Brak terminu ważności Pakietów (w kodzie nie ma wygasania). Regulamin §6 ust. 4 to deklaruje. | Regulamin §6 |
| B6 | Dostęp administratorów do czatu (istnieje `/api/admin/conversations`). Tekst opisuje go jako wyjątek (spór, reklamacja, bezpieczeństwo). Czy to odpowiada praktyce? | Regulamin §9 ust. 3, Polityka pkt 2 |

## C. Decyzje wdrożone w usuwaniu konta, wymagające akceptacji prawnej

Zakres usuwania jest wpisany w kodzie (`ACCOUNT_DELETION_SCOPE`) i pokazywany administratorowi.

1. **Usuwane:** konto Firebase Auth, profil użytkownika, powiadomienia, BeePoints, kody powiązań rodzinnych, zdjęcie i załączniki czatu, profil Nauczyciela, zapisy kolejki e-mail, treść wiadomości napisanych przez użytkownika.
2. **Anonimizowane:** imię/zdjęcie w rozmowach, Lekcjach, pakietach i opiniach (opinia: ocena i komentarz zostają bez autora).
3. **Zachowywane bez ograniczenia czasowego w kodzie:** Lekcje (w tym temat i treść Raportu), Raporty, spory, Pakiety, płatności, zwroty, wypłaty, zdarzenia Stripe, `supportMessages` (formularz kontaktowy, nie jest ruszany), zapis żądania z identyfikatorem konta Stripe Connect. **Nie ma automatycznego czyszczenia po okresie retencji**, bo okresów nie znamy (A3, A4).
4. Pytania: czy komentarze w opiniach i temat/treść Raportów mają być usuwane przy usunięciu konta autora? Czy wiadomości mają zostać dla drugiej strony jako dowód (dziś są kasowane, zostają tylko karty Raportów)? Czy `supportMessages` mają być usuwane po adresie e-mail?
5. Stripe: Runbee **niczego** w Stripe nie zamyka ani nie wypłaca. Dla Nauczyciela z kontem Connect administrator musi potwierdzić ręczne sprawdzenie salda (checkbox w panelu).

## D. Wymagania wdrożeniowe funkcji usuwania

- Konto serwisowe Firebase musi mieć uprawnienia: usuwanie użytkowników Firebase Auth (`accounts:delete`), usuwanie obiektów Cloud Storage (zwykle `Firebase Admin SDK Administrator`) oraz zmienną `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`.
- Reguły Firestore/Storage bez zmian poza wcześniejszymi (`accountStatus` brak = aktywne, `deleted` nie ma już użytkownika Auth).
- Przed pierwszym użyciem na produkcji: przetestować na koncie testowym utworzonym tylko do tego celu (nie na prawdziwym użytkowniku).
