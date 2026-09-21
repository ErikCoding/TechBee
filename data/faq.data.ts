import type { FaqItem } from '@/lib/types'

// Mock data — copy-managed content; will eventually live in a CMS
// or a Firestore `faq` collection so it can be edited without a deploy.
export const faqData: FaqItem[] = [
  {
    question: 'Jak Runbee pomaga znaleźć odpowiedniego nauczyciela?',
    answer: 'Przeglądasz nauczycieli według specjalizacji, lokalizacji, języka i dostępności. Każdy profil zawiera realne doświadczenie zawodowe, certyfikaty, opinie uczniów i wprowadzenie wideo. Przed rezerwacją możesz wysłać wiadomość, aby upewnić się, że to dobry wybór.',
  },
  {
    question: 'Czy nauczyciele Runbee to prawdziwi profesjonaliści w swojej dziedzinie?',
    answer: 'Tak. Każdy nauczyciel na Runbee jest weryfikowany pod kątem realnego doświadczenia zawodowego: sprawdzamy historię zatrudnienia, certyfikaty i przeprowadzamy rozmowę weryfikacyjną na żywo przed dopuszczeniem do nauczania. Nie akceptujemy osób, które mają wyłącznie akademickie doświadczenie bez praktyki w swojej dziedzinie.',
  },
  {
    question: 'Jak wyglądają lekcje?',
    answer: 'Lekcje są indywidualne i odbywają się przez wbudowaną platformę wideo z możliwością udostępniania ekranu. Temat i cele nauki ustalacie z wyprzedzeniem. Nauczyciel wybiera, czy oferuje lekcje 30, 60 lub 120 min, a system dolicza bufor po spotkaniu, żeby kolejne rezerwacje się nie nakładały.',
  },
  {
    question: 'Jak działają płatności?',
    answer: 'Uczeń albo rodzic opłaca konkretną rezerwację przez Stripe. Nauczyciel otrzymuje środki dopiero po zakończonej lekcji i potwierdzonym raporcie. Jeśli raport zostanie zakwestionowany, płatność czeka na rozstrzygnięcie sporu przez administratora.',
  },
  {
    question: 'Czym są BeePoints i jak je zdobywać?',
    answer: 'BeePoints to nasz system lojalnościowy. Zdobywasz je za ukończone lekcje, pisanie opinii, polecanie znajomych i regularność nauki. Punkty odblokowują zniżki, kredyty na darmowe lekcje i dostęp do treści premium.',
  },
  {
    question: 'Czy mogę zostać nauczycielem na Runbee?',
    answer: 'Tak — jeśli masz praktyczne doświadczenie zawodowe w swojej dziedzinie, możesz wysłać zgłoszenie z panelu nauczyciela. Samodzielnie ustalasz stawkę, grafik i dostępność, a profil trafia na giełdę dopiero po weryfikacji przez administratora.',
  },
  {
    question: 'Co jeśli nie będę zadowolony z lekcji?',
    answer: 'Po lekcji nauczyciel wysyła raport. Uczeń albo rodzic może go potwierdzić lub zgłosić zastrzeżenie. Przy sporze administrator widzi opis obu stron i decyduje, czy zwolnić płatność nauczycielowi, czy zwrócić ją płatnikowi.',
  },
  {
    question: 'Czy nauczyciele oferują lekcje próbne?',
    answer: 'Wielu nauczycieli oferuje 30-minutową sesję wprowadzającą w niższej cenie, aby można było ocenić styl nauczania i jakość materiału przed pełnym kursem. Szukaj oznaczenia „Lekcja próbna dostępna” na profilach nauczycieli.',
  },
]
