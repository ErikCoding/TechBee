import { teacherMatchesCategory } from '@/lib/teacher-categories'
import type { Teacher } from '@/lib/types'

export type SubjectPage = {
  slug: string
  categoryId: string
  name: string
  title: string
  description: string
  h1: string
  lead: string
  linkLabel: string
}

export const subjectPages = [
  {
    slug: 'matematyka',
    categoryId: 'mathematics',
    name: 'Matematyka',
    title: 'Korepetycje z matematyki online',
    description:
      'Znajdź nauczyciela matematyki online, porównaj dostępność i zarezerwuj indywidualną lekcję na Runbee.',
    h1: 'Korepetycje z matematyki online',
    lead:
      'Pracuj nad bieżącym materiałem, zaległościami albo przygotowaniem do egzaminu z nauczycielem, którego profil i dostępność możesz sprawdzić przed rezerwacją.',
    linkLabel: 'Matematyka',
  },
  {
    slug: 'angielski',
    categoryId: 'english',
    name: 'Angielski',
    title: 'Korepetycje z angielskiego online',
    description:
      'Wybierz korepetytora języka angielskiego online i zarezerwuj lekcję dopasowaną do Twojego poziomu oraz celu nauki.',
    h1: 'Korepetycje z angielskiego online',
    lead:
      'Porównaj nauczycieli angielskiego, sprawdź ich doświadczenie i wybierz termin lekcji bez dodatkowego ustalania wszystkiego poza platformą.',
    linkLabel: 'Angielski',
  },
  {
    slug: 'polski',
    categoryId: 'polish',
    name: 'Polski',
    title: 'Korepetycje z polskiego online',
    description:
      'Znajdź korepetytora języka polskiego online do pracy nad lekturami, pisaniem, maturą lub egzaminem ósmoklasisty.',
    h1: 'Korepetycje z polskiego online',
    lead:
      'Wybierz nauczyciela, który pomoże uporządkować lektury, poprawić wypracowania albo przygotować się do egzaminu z języka polskiego.',
    linkLabel: 'Polski',
  },
  {
    slug: 'fizyka',
    categoryId: 'physics',
    name: 'Fizyka',
    title: 'Korepetycje z fizyki online',
    description:
      'Sprawdź nauczycieli fizyki online i zarezerwuj lekcję z zadaniami, teorią lub przygotowaniem do egzaminu.',
    h1: 'Korepetycje z fizyki online',
    lead:
      'Znajdź nauczyciela fizyki, który pomoże przejść od wzorów do rozumienia zadań, jednostek i zależności krok po kroku.',
    linkLabel: 'Fizyka',
  },
  {
    slug: 'chemia',
    categoryId: 'chemistry',
    name: 'Chemia',
    title: 'Korepetycje z chemii online',
    description:
      'Porównaj korepetytorów chemii online i wybierz lekcję dopasowaną do szkoły, egzaminu lub konkretnego działu.',
    h1: 'Korepetycje z chemii online',
    lead:
      'Szukaj wsparcia w chemii ogólnej, zadaniach rachunkowych albo przygotowaniu do sprawdzianu u nauczycieli widocznych publicznie na Runbee.',
    linkLabel: 'Chemia',
  },
  {
    slug: 'programowanie',
    categoryId: 'computer-science',
    name: 'Programowanie',
    title: 'Korepetycje z programowania online',
    description:
      'Znajdź nauczyciela programowania online i zarezerwuj indywidualną lekcję z podstaw, algorytmów lub praktycznych projektów.',
    h1: 'Korepetycje z programowania online',
    lead:
      'Wybierz nauczyciela, który prowadzi programowanie praktycznie: od pierwszych podstaw po zadania, projekty i rozwiązywanie konkretnych problemów.',
    linkLabel: 'Programowanie',
  },
] as const satisfies readonly SubjectPage[]

export function getSubjectPageBySlug(slug: string): SubjectPage | undefined {
  return subjectPages.find((page) => page.slug === slug)
}

export function getSubjectPagesWithTeacherCount(teachers: Pick<Teacher, 'categoryId' | 'categoryIds'>[]) {
  return subjectPages
    .map((page) => ({
      page,
      count: teachers.filter((teacher) => teacherMatchesCategory(teacher, page.categoryId)).length,
    }))
    .filter(({ count }) => count > 0)
}
