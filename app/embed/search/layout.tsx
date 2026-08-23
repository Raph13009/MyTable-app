import type { ReactNode } from 'react'

export default function EmbedSearchLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        html, body {
          background: transparent !important;
          overflow: visible !important;
          color-scheme: light;
        }
      `}</style>
      <div className="min-h-[280px] bg-transparent">{children}</div>
    </>
  )
}
