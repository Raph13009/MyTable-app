import type { Metadata } from 'next'
import { EmbedLocationSearch } from '@/components/explore/EmbedLocationSearch'

export const metadata: Metadata = {
  title: 'Recherche de lieu | Guide My Table',
  robots: {
    index: false,
    follow: false,
  },
}

export default function EmbedSearchPage() {
  return <EmbedLocationSearch />
}
