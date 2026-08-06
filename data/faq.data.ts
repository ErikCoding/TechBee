import type { FaqItem } from '@/lib/types'

// Mock data — copy-managed content; will eventually live in a CMS
// or a Firestore `faq` collection so it can be edited without a deploy.
export const faqData: FaqItem[] = [
  {
    question: 'Jak TechBee pomaga znaleźć odpowiedniego nauczyciela?',
    answer: 'Przeglądasz nauczycieli według specjalizacji, lokalizacji, języka i dostępności. Każdy profil zawiera doświadczenie przemysłowe, certyfikaty, opinie uczniów i wprowadzenie wideo. Przed rezerwacją możesz wysłać wiadomość, aby upewnić się, że to dobry wybór.',
  },
  {
    question: 'Czy nauczyciele TechBee to prawdziwi profesjonaliści z przemysłu?',
    answer: 'Tak. Każdy nauczyciel na TechBee jest weryfikowany pod kątem realnego doświadczenia przemysłowego: sprawdzamy historię zatrudnienia, certyfikaty i przeprowadzamy rozmowę techniczną na żywo przed dopuszczeniem do nauczania. Nie akceptujemy osób, które mają wyłącznie akademickie doświadczenie bez praktyki w terenie.',
  },
  {
    question: 'Jak wyglądają lekcje?',
    answer: 'Lekcje są indywidualne i odbywają się przez wbudowaną platformę wideo, udostępnianie ekranu oraz cyfrową tablicę. Temat i cele nauki ustalacie z wyprzedzeniem. Większość lekcji trwa 60 albo 90 minut. Sesje można nagrać do późniejszej powtórki.',
  },
  {
    question: 'Czym są BeeCoins i jak działają płatności?',
    answer: 'BeeCoins to waluta platformy. Doładowujesz portfel złotówkami, kartą lub przelewem i wymieniasz środki na BeeCoins. Lekcje są rozliczane w BeeCoins, co chroni obie strony: nauczyciele otrzymują płatność terminowo, a uczniowie mają pełną przejrzystość cen.',
  },
  {
    question: 'Czym są BeePoints i jak je zdobywać?',
    answer: 'BeePoints to nasz system lojalnościowy. Zdobywasz je za ukończone lekcje, pisanie opinii, polecanie znajomych i regularność nauki. Punkty odblokowują zniżki, kredyty na darmowe lekcje i dostęp do treści premium.',
  },
  {
    question: 'Czy mogę zostać nauczycielem na TechBee?',
    answer: 'Tak — jeśli masz co najmniej 3 lata praktycznego doświadczenia przemysłowego w specjalizacji technicznej, zachęcamy do zgłoszenia. Samodzielnie ustalasz stawkę, grafik i dostępność. Najlepsi nauczyciele zarabiają 15 000 zł+ miesięcznie, pracując na część etatu.',
  },
  {
    question: 'Co jeśli nie będę zadowolony z lekcji?',
    answer: 'Oferujemy gwarancję satysfakcji. Jeśli lekcja nie spełni oczekiwań, skontaktuj się z naszym wsparciem w ciągu 24 godzin, a zwrócimy pełną kwotę w BeeCoins bez dodatkowych pytań. Satysfakcja uczniów jest naszym priorytetem.',
  },
  {
    question: 'Czy nauczyciele oferują lekcje próbne?',
    answer: 'Wielu nauczycieli oferuje 30-minutową sesję wprowadzającą w niższej cenie, aby można było ocenić styl nauczania i jakość materiału przed pełnym kursem. Szukaj oznaczenia „Lekcja próbna dostępna” na profilach nauczycieli.',
  },
]
