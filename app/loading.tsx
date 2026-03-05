/**
 * Loading UI shown during initial app load (e.g. when opening app from
 * "Voir le profil" on embedded explore - new tab on Android).
 * Même animation que le passage liste ↔ carte (logo + spinner autour).
 */
export default function RootLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FCFCFA]">
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
    </div>
  )
}
