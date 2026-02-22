import { RegionsMap } from '@/components/regions/RegionsMap'

export default function RegionsPage() {
  return (
    <main className="min-h-screen bg-[#F7F7F7] px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-[1400px] rounded-[24px] border border-[#ECECEC] bg-white p-5 shadow-[0_14px_40px_rgba(0,0,0,0.06)] sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7B7B7B]">Regions</p>
          <h1 className="mt-1 text-2xl font-semibold text-[#111111] sm:text-3xl">Choisissez une région</h1>
        </div>
        <RegionsMap />
      </div>
    </main>
  )
}
