export default function BookChefLoading() {
  return (
    <div className="min-h-screen bg-[#FCFCFA]">
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-black/20 bg-[#FBCF03] shadow-md">
        <div className="relative mx-auto max-w-4xl px-4 py-2.5 sm:px-6 sm:py-3.5">
          <div className="flex items-center justify-center">
            <img src="/logo-banner.jpeg" alt="MyTable" className="h-10 w-auto object-contain sm:h-12 md:h-14" />
          </div>
        </div>
      </div>

      <div className="pt-24 sm:pt-28">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="animate-pulse space-y-4 rounded-3xl border border-[#EAEAEA] bg-white p-6 shadow-[0_8px_22px_rgba(0,0,0,0.06)]">
            <div className="h-6 w-48 rounded-full bg-[#EFEFEF]" />
            <div className="h-4 w-72 rounded-full bg-[#F2F2F2]" />
            <div className="h-28 rounded-2xl bg-[#F6F6F6]" />
            <div className="h-28 rounded-2xl bg-[#F6F6F6]" />
          </div>
          <p className="mt-4 text-center text-sm font-medium text-[#6A6A6A]">Chargement de la reservation...</p>
        </div>
      </div>
    </div>
  )
}

