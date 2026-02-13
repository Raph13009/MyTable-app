'use client'

import { useEffect, useMemo, useState } from 'react'

type Period = 'day' | 'week' | 'month' | 'all' | 'custom'

type StatusKey = 'pending' | 'accepted' | 'refused' | 'expired' | 'validated_by_client' | 'cancelled' | 'completed'

interface AnalyticsResponse {
  generatedAt: string
  period: Period
  dateRange: {
    start: string
    end: string
  }
  kpis: {
    requests: number
    requestsDelta: number | null
    ongoingAcceptedConversations: number
    ongoingAcceptedDelta: number | null
    messages: number
    messagesDelta: number | null
  }
  statusDistribution: Array<{
    status: StatusKey
    count: number
  }>
  activityBuckets: Array<{
    key: string
    label: string
    requests: number
    messages: number
  }>
  topChefs: Array<{
    chefId: string
    name: string
    profilePicture: string | null
    requestCount: number
  }>
}

const STATUS_LABELS: Record<StatusKey, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  refused: 'Refusée',
  expired: 'Expirée',
  validated_by_client: 'Validée client',
  cancelled: 'Annulée',
  completed: 'Terminée',
}

const STATUS_COLORS: Record<StatusKey, string> = {
  pending: '#FBCF03',
  accepted: '#2563eb',
  refused: '#ef4444',
  expired: '#6b7280',
  validated_by_client: '#0ea5e9',
  cancelled: '#9ca3af',
  completed: '#16a34a',
}

function formatDelta(value: number | null) {
  if (value === null) return 'n/a'
  if (value > 0) return `+${value}%`
  return `${value}%`
}

function deltaTextColor(value: number | null) {
  if (value === null) return 'text-gray-400'
  if (value > 0) return 'text-emerald-600'
  if (value < 0) return 'text-red-600'
  return 'text-gray-500'
}

function periodCompareLabel(period: Period) {
  if (period === 'day') return 'vs hier'
  if (period === 'week') return 'vs semaine précédente'
  if (period === 'month') return 'vs mois précédent'
  if (period === 'custom') return 'vs période précédente'
  return 'comparaison indisponible'
}

function buildDonutGradient(data: Array<{ color: string; value: number }>) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  if (total === 0) {
    return 'conic-gradient(#e5e7eb 0 100%)'
  }

  let cursor = 0
  const parts = data
    .map((item) => {
      const size = (item.value / total) * 100
      const from = cursor
      const to = cursor + size
      cursor = to
      return `${item.color} ${from}% ${to}%`
    })
    .join(', ')

  return `conic-gradient(${parts})`
}

function formatInputDate(dateIso: string) {
  return new Date(dateIso).toISOString().slice(0, 10)
}

function formatRangeLabel(startIso: string, endIso: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const fmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  return `${fmt.format(start)} - ${fmt.format(end)}`
}

function LineChart({
  buckets,
}: {
  buckets: AnalyticsResponse['activityBuckets']
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const width = 900
  const height = 320
  const paddingLeft = 52
  const paddingRight = 52
  const paddingTop = 32
  const paddingBottom = 52

  const maxRequests = Math.max(...buckets.map((bucket) => bucket.requests), 1)
  const maxMessages = Math.max(...buckets.map((bucket) => bucket.messages), 1)

  const stepX = buckets.length > 1 ? (width - paddingLeft - paddingRight) / (buckets.length - 1) : 0
  const chartHeight = height - paddingTop - paddingBottom
  const chartBottom = height - paddingBottom

  const requestsCoordinates = buckets.map((bucket, index) => {
    const x = paddingLeft + index * stepX
    const y = chartBottom - (bucket.requests / maxRequests) * chartHeight
    return { x, y }
  })

  const messagesCoordinates = buckets.map((bucket, index) => {
    const x = paddingLeft + index * stepX
    const y = chartBottom - (bucket.messages / maxMessages) * chartHeight
    return { x, y }
  })

  const requestsPoints = requestsCoordinates.map((point) => `${point.x},${point.y}`).join(' ')
  const messagesPoints = messagesCoordinates.map((point) => `${point.x},${point.y}`).join(' ')

  const ticks = [0, 0.25, 0.5, 0.75, 1]
  const xTickStep = Math.max(1, Math.ceil((Math.max(buckets.length, 2) - 1) / 6))
  const xTickIndices = Array.from(new Set([
    0,
    ...buckets.map((_, index) => index).filter((index) => index % xTickStep === 0),
    Math.max(buckets.length - 1, 0),
  ]))

  const hoveredBucket = hoveredIndex !== null ? buckets[hoveredIndex] : null
  const hoveredRequestPoint = hoveredIndex !== null ? requestsCoordinates[hoveredIndex] : null
  const hoveredX = hoveredRequestPoint?.x ?? 0
  const tooltipDate = hoveredBucket
    ? new Intl.DateTimeFormat('fr-FR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(hoveredBucket.key))
    : ''
  const tooltipWidth = 160
  const tooltipX = Math.min(Math.max(hoveredX - tooltipWidth / 2, paddingLeft), width - paddingRight - tooltipWidth)
  const tooltipY = 40

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-72"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {ticks.map((ratio) => {
          const y = chartBottom - ratio * chartHeight
          const leftValue = Math.round(ratio * maxRequests)
          const rightValue = Math.round(ratio * maxMessages)
          return (
            <g key={`grid-${ratio}`}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text x={paddingLeft - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#6b7280">
                {leftValue}
              </text>
              <text x={width - paddingRight + 10} y={y + 4} textAnchor="start" fontSize="11" fill="#6b7280">
                {rightValue}
              </text>
            </g>
          )
        })}

        <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={chartBottom} stroke="#d1d5db" strokeWidth="1" />
        <line x1={width - paddingRight} y1={paddingTop} x2={width - paddingRight} y2={chartBottom} stroke="#d1d5db" strokeWidth="1" />
        <line x1={paddingLeft} y1={chartBottom} x2={width - paddingRight} y2={chartBottom} stroke="#d1d5db" strokeWidth="1" />
        <text x={paddingLeft} y={14} textAnchor="start" fontSize="11" fill="#92400e">
          Demandes (axe gauche)
        </text>
        <text x={width - paddingRight} y={14} textAnchor="end" fontSize="11" fill="#1d4ed8">
          Messages (axe droit)
        </text>

        {buckets.map((bucket, index) => {
          const prevX = index === 0 ? paddingLeft : paddingLeft + (index - 0.5) * stepX
          const nextX = index === buckets.length - 1 ? width - paddingRight : paddingLeft + (index + 0.5) * stepX
          return (
            <rect
              key={`hover-zone-${bucket.key}`}
              x={prevX}
              y={paddingTop}
              width={Math.max(nextX - prevX, 1)}
              height={chartBottom - paddingTop}
              fill="transparent"
              onMouseEnter={() => setHoveredIndex(index)}
              style={{ cursor: 'pointer' }}
            />
          )
        })}

        {hoveredBucket && hoveredRequestPoint && (
          <>
            <line
              x1={hoveredX}
              y1={paddingTop}
              x2={hoveredX}
              y2={chartBottom}
              stroke="#9ca3af"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <g transform={`translate(${tooltipX}, ${tooltipY})`}>
              <rect width={tooltipWidth} height={68} rx={8} fill="#111827" opacity={0.96} />
              <text x={10} y={16} fontSize="10" fill="#d1d5db">
                {tooltipDate}
              </text>
              <circle cx={12} cy={34} r={3} fill="#F59E0B" />
              <text x={20} y={37} fontSize="11" fill="#f9fafb">
                Demandes: {hoveredBucket.requests}
              </text>
              <circle cx={12} cy={52} r={3} fill="#3B82F6" />
              <text x={20} y={55} fontSize="11" fill="#f9fafb">
                Messages: {hoveredBucket.messages}
              </text>
            </g>
          </>
        )}

        <polyline
          fill="none"
          stroke="#F59E0B"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={requestsPoints}
        />

        <polyline
          fill="none"
          stroke="#3B82F6"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={messagesPoints}
        />

        {requestsCoordinates.map((point) => (
          <circle key={`request-point-${point.x}`} cx={point.x} cy={point.y} r="2.8" fill="#F59E0B" />
        ))}
        {messagesCoordinates.map((point) => (
          <circle key={`message-point-${point.x}`} cx={point.x} cy={point.y} r="2.8" fill="#3B82F6" />
        ))}

        {xTickIndices.map((index) => {
          const point = requestsCoordinates[index]
          const bucket = buckets[index]
          if (!point || !bucket) return null
          return (
            <g key={`x-label-${bucket.key}`}>
              <line x1={point.x} y1={chartBottom} x2={point.x} y2={chartBottom + 5} stroke="#9ca3af" strokeWidth="1" />
              <text x={point.x} y={chartBottom + 18} textAnchor="middle" fontSize="11" fill="#6b7280">
                {bucket.label}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="mt-2 flex items-center gap-6 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          <span>Demandes</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span>Messages</span>
        </div>
      </div>
    </div>
  )
}

export default function AdminAnalytics() {
  const [period, setPeriod] = useState<Period>('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [appliedCustomStart, setAppliedCustomStart] = useState('')
  const [appliedCustomEnd, setAppliedCustomEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<AnalyticsResponse | null>(null)

  const buildUrl = () => {
    const params = new URLSearchParams({ period })
    if (period === 'custom' && appliedCustomStart && appliedCustomEnd) {
      params.set('start', appliedCustomStart)
      params.set('end', appliedCustomEnd)
    }
    return `/api/admin/analytics?${params.toString()}`
  }

  const fetchAnalytics = async () => {
    if (period === 'custom' && (!appliedCustomStart || !appliedCustomEnd)) {
      setLoading(false)
      setError('Sélectionne une plage personnalisée puis clique sur "Appliquer la période".')
      return
    }

    try {
      setError('')
      const response = await fetch(buildUrl(), {
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error('Impossible de charger les analytics')
      }

      const payload = (await response.json()) as AnalyticsResponse
      setData(payload)

      if (!customStart && !customEnd) {
        setCustomStart(formatInputDate(payload.dateRange.start))
        setCustomEnd(formatInputDate(payload.dateRange.end))
        setAppliedCustomStart(formatInputDate(payload.dateRange.start))
        setAppliedCustomEnd(formatInputDate(payload.dateRange.end))
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchAnalytics()

    const interval = window.setInterval(() => {
      fetchAnalytics()
    }, 60_000)

    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, appliedCustomStart, appliedCustomEnd])

  const donutData = useMemo(() => {
    if (!data) return [] as Array<{ label: string; color: string; value: number }>

    return data.statusDistribution.map((item) => ({
      label: STATUS_LABELS[item.status],
      color: STATUS_COLORS[item.status],
      value: item.count,
    }))
  }, [data])

  const totalStatuses = donutData.reduce((sum, item) => sum + item.value, 0)

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Chargement des analytics...</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )
  }

  if (!data) return null

  const maxTopChefCount = Math.max(...data.topChefs.map((chef) => chef.requestCount), 1)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-black">Analytics</h2>
            <p className="text-sm text-gray-500">
              Mis à jour auto toutes les 60s. Dernière sync: {new Date(data.generatedAt).toLocaleTimeString('fr-FR')}
            </p>
            <p className="text-xs text-gray-500">Plage active: {formatRangeLabel(data.dateRange.start, data.dateRange.end)}</p>
          </div>

          <div className="inline-flex flex-wrap rounded-xl border border-gray-200 bg-white p-1">
              {([
                { key: 'day', label: 'Jour' },
                { key: 'week', label: 'Semaine' },
                { key: 'month', label: 'Mois' },
                { key: 'all', label: 'Global' },
                { key: 'custom', label: 'Personnalisé' },
              ] as Array<{ key: Period; label: string }>).map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setError('')
                    setPeriod(item.key)
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    period === item.key ? 'bg-[#FBCF03] text-black' : 'text-gray-600 hover:text-black'
                  }`}
                >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {period === 'custom' && (
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-3">
            <label className="text-sm text-gray-600">
              Début
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-gray-600">
              Fin
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex items-end">
              <button
                onClick={() => {
                  if (!customStart || !customEnd) {
                    setError('Merci de renseigner une date de début et une date de fin.')
                    return
                  }

                  if (customStart > customEnd) {
                    setError('La date de début doit être antérieure ou égale à la date de fin.')
                    return
                  }

                  setError('')
                  setAppliedCustomStart(customStart)
                  setAppliedCustomEnd(customEnd)
                }}
                className="w-full rounded-lg bg-[#FBCF03] px-3 py-2 text-sm font-semibold text-black hover:bg-[#E6BA00]"
              >
                Appliquer la période
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Demandes (période)</p>
          <p className="mt-2 text-3xl font-bold text-black">{data.kpis.requests}</p>
          <p className={`mt-2 text-sm font-medium ${deltaTextColor(data.kpis.requestsDelta)}`}>
            {formatDelta(data.kpis.requestsDelta)} {periodCompareLabel(data.period)}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Conversations en cours (accepted)</p>
          <p className="mt-2 text-3xl font-bold text-black">{data.kpis.ongoingAcceptedConversations}</p>
          <p className={`mt-2 text-sm font-medium ${deltaTextColor(data.kpis.ongoingAcceptedDelta)}`}>
            {formatDelta(data.kpis.ongoingAcceptedDelta)} {periodCompareLabel(data.period)}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Messages envoyés (période)</p>
          <p className="mt-2 text-3xl font-bold text-black">{data.kpis.messages}</p>
          <p className={`mt-2 text-sm font-medium ${deltaTextColor(data.kpis.messagesDelta)}`}>
            {formatDelta(data.kpis.messagesDelta)} {periodCompareLabel(data.period)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 xl:col-span-2">
          <h3 className="text-lg font-semibold text-black">Répartition des statuts</h3>
          <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center">
            <div
              className="relative h-48 w-48 rounded-full"
              style={{
                backgroundImage: buildDonutGradient(donutData),
              }}
            >
              <div className="absolute inset-6 flex items-center justify-center rounded-full bg-white text-center">
                <div>
                  <p className="text-3xl font-bold text-black">{totalStatuses}</p>
                  <p className="text-xs text-gray-500">demandes</p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              {donutData.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune donnée sur cette période</p>
              ) : (
                donutData.map((item) => {
                  const percent = totalStatuses > 0 ? Math.round((item.value / totalStatuses) * 100) : 0
                  return (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-gray-700">{item.label}</span>
                      </div>
                      <span className="font-medium text-black">
                        {item.value} ({percent}%)
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 xl:col-span-3">
          <h3 className="text-lg font-semibold text-black">Volume d&apos;activité</h3>
          <p className="mt-1 text-sm text-gray-500">Survolez la courbe pour afficher le détail journalier</p>
          <div className="mt-4">
            <LineChart buckets={data.activityBuckets} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-black">Top 3 chefs (nombre de demandes)</h3>

        {data.topChefs.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Aucun chef sur cette période.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {data.topChefs.map((chef, index) => (
              <div key={chef.chefId} className="flex items-center gap-4">
                <div className="w-6 text-sm font-semibold text-gray-400">#{index + 1}</div>

                {chef.profilePicture ? (
                  <img
                    src={chef.profilePicture}
                    alt={chef.name}
                    className="h-12 w-12 rounded-full border border-gray-200 object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                    {chef.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="truncate font-medium text-black">{chef.name}</p>
                    <p className="text-sm font-semibold text-black">{chef.requestCount}</p>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-[#FBCF03]"
                      style={{ width: `${Math.max((chef.requestCount / maxTopChefCount) * 100, 6)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
