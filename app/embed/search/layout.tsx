import type { ReactNode } from 'react'

export default function EmbedSearchLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        html, body {
          background: transparent !important;
          overflow: hidden !important;
          color-scheme: light;
        }
        .gmt-embed-search input::placeholder {
          color: #6B6B6B !important;
          font-size: 12px !important;
        }
      `}</style>
      <div className="min-h-[280px] bg-transparent">{children}</div>
    </>
  )
}
