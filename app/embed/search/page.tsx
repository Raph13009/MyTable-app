import type { Metadata } from 'next'
import { EmbedLocationSearch } from '@/components/explore/EmbedLocationSearch'
import { parseEmbedSearchLocale } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Recherche de lieu | Guide My Table',
  // Inherit app-wide noindex; keep follow consistent with root layout.
  robots: {
    index: false,
    follow: true,
  },
}

type EmbedSearchPageProps = {
  searchParams?: {
    lang?: string
  }
}

export default function EmbedSearchPage({ searchParams }: EmbedSearchPageProps) {
  const initialLocale = parseEmbedSearchLocale(searchParams?.lang)

  return <EmbedLocationSearch initialLocale={initialLocale} />
}
