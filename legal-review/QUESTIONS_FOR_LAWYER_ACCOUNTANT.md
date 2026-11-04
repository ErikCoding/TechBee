# Pytania do prawnika i księgowego (stan po Etapie 1, 3.11.2026)

Wszystkie dokumenty prawne w kodzie to SZKICE do weryfikacji. Ostrzeżenie „Szkic dokumentu” znika po ustawieniu `reviewed` w `LegalPage`.

## Do uzupełnienia przez operatora (nie wymaga prawnika)
- `config/operator.ts` → `correspondenceAddress` (obecnie placeholder `[ADRES DO KORESPONDENCJI]`).
- Potwierdzić, że wpisane tam imię i nazwisko jest właściwe dla działalności nierejestrowanej.

## Prawnik
1. **Model pośrednika a przepływ pieniędzy.** Płatność ucznia (cała kwota) trafia na konto Stripe Runbee, jest tam trzymana do potwierdzenia raportu, potem część idzie do korepetytora (Separate Charges & Transfers). Czy Regulamin (umowa uczeń–korepetytor) i taki obieg środków da się pogodzić, i czy nie wchodzimy w usługi płatnicze (agent / wyłączenie platformowe)?
2. **Zgoda na rozpoczęcie usługi przed upływem 14 dni** (art. 38 pkt 1 u.p.k.): czy checkbox przy płatności o treści z `lib/withdrawal-consent.ts` wystarcza, szczególnie przy pakietach lekcji, które są wykonywane stopniowo?
3. **DAC7:** czy przy działalności nierejestrowanej i naszym modelu jesteśmy „operatorem platformy” z obowiązkiem raportowania sprzedawców? Co zbierać (PESEL/NIP, adres, data urodzenia, rachunek) i od kiedy.
4. **Baner cookies:** czy Vercel Analytics bez zgody wymaga banera (ePrivacy)?
5. **Nieletni:** poniżej 16 lat zgoda rodzica na dane (RODO art. 8), poniżej 18 lat zdolność do umów. Czy wystarczy oświadczenie przy rejestracji i konto rodzica jako strona płatności?
6. **DSA:** czy punkt kontaktowy i procedura zgłoszeń z §9b Regulaminu spełniają wymagania dla naszej skali (mikroprzedsiębiorca)? Czy trzeba coś jeszcze (np. raportowanie)?
7. **Omnibus / ranking:** opis w §9a (domyślnie „Wyróżnieni” ustawiani przez operatora, brak płatnej reklamy). Czy opis weryfikacji opinii jest wystarczający? Uwaga: potwierdzić, że wyróżnienia nie są dziś sprzedawane.
8. **Ustawa Kamilka:** jakie dokładnie standardy ochrony małoletnich obowiązują nasz serwis (zajęcia online, brak fizycznego kontaktu) i kto musi być wskazany jako osoba odpowiedzialna.
9. **Zakaz omijania platformy i odpowiedzialność** (§7 Warunków dla Nauczycieli): czy klauzule są dopuszczalne wobec konsumentów i przedsiębiorców.
10. **Okresy przechowywania danych** (Polityka pkt 6) i usuwanie komentarzy w raportach/opiniach po usunięciu konta.
11. **Zmiana prowizji z 14-dniowym wyprzedzeniem** (Warunki §4 ust. 1) i zmiana Regulaminu — czy to wystarczające wypowiedzenie.
12. **Przejście na sp. z o.o.:** jak przenieść umowy, konta Stripe Connect i zgody użytkowników (cesja / zawiadomienie).

## Księgowy
1. **Co wlicza się do limitu 10 813,50 zł na kwartał:** wyłącznie prowizja + opłata serwisowa (przychód Runbee), czy cały obrót przez konto Stripe? Panel pokazuje obie wartości (Admin → przegląd).
2. **Moment powstania przychodu:** data płatności, data lekcji czy data potwierdzenia raportu? Dla pakietów: prowizja za wykorzystane lekcje (obecna logika) czy w całości przy zakupie?
3. **Koszty Stripe:** pomniejszają przychód czy są kosztem? CSV zawiera kolumnę „Koszt Stripe”.
4. **Ewidencja sprzedaży:** czy eksport CSV (data, rodzaj, id, kwoty, zgoda) spełnia wymogi ewidencji dla działalności nierejestrowanej? Czy potrzebny jest dodatkowy dokument (rachunek) dla ucznia?
5. **VAT i faktury:** czy opłata serwisowa i prowizja podlegają VAT w naszej sytuacji; kto wystawia dokument za Lekcję.
6. **Chargebacki:** konfiguracja Stripe (`losses_collector: application`) oznacza, że straty z reklamacji kartowych obciążają Runbee. Jak je księgować i czy ubezpieczać.
7. **Wypłaty z Stripe** na rachunek prywatny operatora (gdyby kiedykolwiek były potrzebne) — jak rozdzielić od środków uczniów i korepetytorów.
8. **Rejestracja w CEIDG po przekroczeniu limitu:** 7 dni, od kiedy liczyć i jakie kroki przygotować z wyprzedzeniem (ostrzeżenia 80% i 95% w panelu).
