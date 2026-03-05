/**
 * Loading pour /book/[chefSlug] - affiché quand on ouvre "Voir le profil"
 * depuis l'explore embarqué (ex: guidemytable.fr).
 * Même animation que le passage liste ↔ carte (logo + spinner autour).
 */
export default function BookChefLoading() {
  return (
    <div className="min-h-screen bg-[#FCFCFA]">
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-black/20 bg-[#FBCF03] shadow-md">
        <div className="relative mx-auto max-w-4xl px-4 py-2.5 sm:px-6 sm:py-3.5">
          <div className="flex items-center justify-center">
            <img
              src="/logo-banner.jpeg"
              alt="MyTable"
              className="h-9 w-auto max-h-12 object-contain sm:h-11 md:h-12"
              width={120}
              height={48}
            />
          </div>
        </div>
      </div>

      <div className="flex min-h-screen flex-col items-center justify-center px-4 pt-20">
        <div className="relative h-24 w-24">
          <div className="absolute inset-0 rounded-full border border-[#F8E7A0] animate-ping [animation-duration:1400ms]" />
          <div className="absolute inset-[10px] rounded-full border-2 border-[#F1D56A]/60 border-t-[#D4A602] animate-spin [animation-duration:900ms]" />
          <div className="absolute inset-[22px] rounded-full bg-white shadow-[0_6px_20px_rgba(0,0,0,0.08)]" />
          <img
            src="/logo-cercle.png"
            alt="MyTable"
            className="absolute inset-0 m-auto h-10 w-10 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.12)]"
            width={40}
            height={40}
          />
        </div>
        <p className="mt-6 text-center text-sm font-medium text-[#6A6A6A]">
          Chargement de la réservation...
        </p>
      </div>
    </div>
  )
}

