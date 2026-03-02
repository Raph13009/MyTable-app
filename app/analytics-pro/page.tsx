'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ADMIN_UID = '8d154623-1aba-475c-9a7b-9ab39f3f84d2'

interface AnalyticsProData {
  period: { start: string; end: string; days: number }
  searchesPerDay: Array<{ date: string; count: number }>
  profileViewsByChef: Array<{
    chef_id: string
    count: number
    name: string
    slug?: string
  }>
  conversion: {
    usersWhoMessaged: number
    usersWhoBooked: number
    usersWhoMessagedAndBooked: number
    messageToBookingConversionPct: number
  }
  funnel: {
    search: number
    profile_view: number
    message_sent: number
    booking_request: number
  }
  auth: { signup: number; login: number }
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(d))
}

export default function AnalyticsProPage() {
  const router = useRouter()
  const supabase = createClient()
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)
  const [data, setData] = useState<AnalyticsProData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [days, setDays] = useState(14)

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setAuthenticated(!!user && user.id === ADMIN_UID)
      setChecking(false)
    }
    check()
  }, [supabase.auth])

  useEffect(() => {
    if (!authenticated) return

    const fetchData = async () => {
      try {
        setError('')
        const res = await fetch(`/api/analytics-pro?days=${days}`)
        if (res.status === 403) {
          router.replace('/login?next=/analytics-pro')
          return
        }
        if (!res.ok) throw new Error('Erreur chargement')
        const json = await res.json()
        setData(json)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }

    setLoading(true)
    fetchData()
  }, [authenticated, days, router])

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Vérification...</p>
      </div>
    )
  }

  if (!authenticated) {
    router.replace('/login?next=/analytics-pro')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#FBCF03] border-b-2 border-black shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-3">
              <img
                src="/logo-banner.jpeg"
                alt="MyTable"
                className="h-10 sm:h-12 w-auto object-contain"
              />
              <h1 className="text-lg sm:text-xl font-bold text-black">Analytics</h1>
              <span className="inline-flex items-center rounded-full bg-black px-2.5 py-0.5 text-xs font-semibold text-[#FBCF03]">
                PRO
              </span>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 text-sm font-semibold text-black bg-white/90 hover:bg-white border-2 border-black rounded-lg transition-all"
            >
              Retour admin
            </button>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Période :</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value={7}>7 jours</option>
            <option value={14}>14 jours</option>
            <option value={30}>30 jours</option>
            <option value={90}>90 jours</option>
          </select>
        </div>

        {loading && !data ? (
          <div className="py-12 text-center text-gray-500">Chargement...</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
        ) : !data ? null : (
          <div className="space-y-8">
            {/* Funnel */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Funnel</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { key: 'search', label: 'Recherches', value: data.funnel.search },
                  { key: 'profile_view', label: 'Profils vus', value: data.funnel.profile_view },
                  { key: 'message_sent', label: 'Messages envoyés', value: data.funnel.message_sent },
                  { key: 'booking_request', label: 'Demandes de résa', value: data.funnel.booking_request },
                ].map(({ key, label, value }) => (
                  <div
                    key={key}
                    className="rounded-xl bg-gray-50 p-4 text-center"
                  >
                    <div className="text-2xl font-bold text-gray-900">{value}</div>
                    <div className="text-sm text-gray-600 mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Conversion message → booking */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Conversion message → réservation
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="rounded-xl bg-gray-50 p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {data.conversion.usersWhoMessaged}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Ont envoyé un message</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {data.conversion.usersWhoBooked}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Ont fait une demande</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600">
                    {data.conversion.usersWhoMessagedAndBooked}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Les deux</div>
                </div>
                <div className="rounded-xl bg-[#FBCF03]/20 p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {data.conversion.messageToBookingConversionPct}%
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Taux de conversion</div>
                </div>
              </div>
            </section>

            {/* Searches per day */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Recherches par jour
              </h2>
              <div className="overflow-x-auto -mx-2">
                <div className="flex gap-1 min-w-max py-2 px-2" style={{ height: 120 }}>
                  {data.searchesPerDay.map(({ date, count }) => {
                    const max = Math.max(...data.searchesPerDay.map((d) => d.count), 1)
                    const h = (count / max) * 80
                    return (
                      <div
                        key={date}
                        className="flex flex-col items-center gap-1 shrink-0"
                        style={{ width: 24 }}
                      >
                        <div
                          className="w-4 rounded-t bg-[#FBCF03] min-h-[4px]"
                          style={{ height: Math.max(h, 4) }}
                          title={`${formatDate(date)}: ${count}`}
                        />
                        <span className="text-[10px] text-gray-500 rotate-[-45deg] origin-top-left">
                          {formatDate(date).slice(0, 5)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* Profile views by chef */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Profils vus par chef
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Chef</th>
                      <th className="text-right py-3 px-2 font-medium text-gray-700">Vues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.profileViewsByChef.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="py-8 text-center text-gray-500">
                          Aucune donnée
                        </td>
                      </tr>
                    ) : (
                      data.profileViewsByChef.map((row) => (
                        <tr key={row.chef_id} className="border-b border-gray-100">
                          <td className="py-2.5 px-2">{row.name}</td>
                          <td className="py-2.5 px-2 text-right font-medium">
                            {row.count}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Auth */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Inscriptions & connexions</h2>
              <div className="flex gap-4">
                <div className="rounded-xl bg-gray-50 px-6 py-4">
                  <span className="text-2xl font-bold text-gray-900">{data.auth.signup}</span>
                  <span className="ml-2 text-gray-600">inscriptions</span>
                </div>
                <div className="rounded-xl bg-gray-50 px-6 py-4">
                  <span className="text-2xl font-bold text-gray-900">{data.auth.login}</span>
                  <span className="ml-2 text-gray-600">connexions</span>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
