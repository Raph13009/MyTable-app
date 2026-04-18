'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type AdminEmailRow = {
  email: string
  role: 'client' | 'chef'
  created_at: string | null
}

type Payload = {
  clients: AdminEmailRow[]
  chefs: AdminEmailRow[]
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function matchesQuery(email: string, q: string) {
  if (!q.trim()) return true
  return email.toLowerCase().includes(q.trim().toLowerCase())
}

export default function AdminEmails() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/admin/emails')
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Impossible de charger les e-mails')
        }
        const json = (await res.json()) as Payload
        if (!cancelled) setPayload(json)
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Erreur inconnue')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  const copyCsv = useCallback(
    async (label: string, emails: string[]) => {
      const text = emails.join(', ')
      try {
        await navigator.clipboard.writeText(text)
        showToast(label)
      } catch {
        showToast('Copie impossible (permissions navigateur)')
      }
    },
    [showToast]
  )

  const filteredClients = useMemo(() => {
    if (!payload) return []
    return payload.clients.filter((r) => matchesQuery(r.email, query))
  }, [payload, query])

  const filteredChefs = useMemo(() => {
    if (!payload) return []
    return payload.chefs.filter((r) => matchesQuery(r.email, query))
  }, [payload, query])

  const allFilteredEmails = useMemo(
    () => [
      ...filteredClients.map((r) => r.email),
      ...filteredChefs.map((r) => r.email),
    ],
    [filteredClients, filteredChefs]
  )

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-600">
        Chargement…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
        {error}
      </div>
    )
  }

  const nClients = payload?.clients.length ?? 0
  const nChefs = payload?.chefs.length ?? 0

  return (
    <div className="relative space-y-6">
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-900 shadow-lg"
        >
          {toast}
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold text-black">E-mails</h2>
        <p className="mt-1 text-sm text-gray-600">
          Clients : formulaires de réservation et participants messagerie. Chefs : fiches
          &quot;chefs&quot; en base.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm text-gray-700">
          <span className="font-semibold text-black">{nClients}</span> client
          {nClients !== 1 ? 's' : ''}
          <span className="mx-2 text-gray-400">·</span>
          <span className="font-semibold text-black">{nChefs}</span> chef
          {nChefs !== 1 ? 's' : ''}
          {query.trim() ? (
            <>
              <span className="mx-2 text-gray-400">·</span>
              filtré : {filteredClients.length + filteredChefs.length} ligne(s)
            </>
          ) : null}
        </p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un e-mail…"
          className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-[#FBCF03] sm:w-72"
          aria-label="Filtrer par e-mail"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            copyCsv('Liste copiée (virgules)', allFilteredEmails)
          }
          className="rounded-lg border-2 border-black bg-[#FBCF03] px-4 py-2 text-sm font-semibold text-black hover:bg-[#E6BA00]"
        >
          Copier tous les e-mails
        </button>
        <button
          type="button"
          onClick={() =>
            copyCsv(
              'E-mails clients copiés',
              filteredClients.map((r) => r.email)
            )
          }
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-50"
        >
          Copier clients
        </button>
        <button
          type="button"
          onClick={() =>
            copyCsv(
              'E-mails chefs copiés',
              filteredChefs.map((r) => r.email)
            )
          }
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-50"
        >
          Copier chefs
        </button>
      </div>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold text-black">
          Clients{' '}
          <span className="font-normal text-gray-500">
            ({filteredClients.length} affiché{filteredClients.length !== 1 ? 's' : ''})
          </span>
        </h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-3 py-2 font-semibold text-black">E-mail</th>
                <th className="px-3 py-2 font-semibold text-black">Rôle</th>
                <th className="px-3 py-2 font-semibold text-black">Première trace</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-gray-500" colSpan={3}>
                    Aucun résultat.
                  </td>
                </tr>
              ) : (
                filteredClients.map((row) => (
                  <tr
                    key={`c-${row.email}`}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="px-3 py-2 font-mono text-black">{row.email}</td>
                    <td className="px-3 py-2 text-gray-700">client</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {formatWhen(row.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold text-black">
          Chefs{' '}
          <span className="font-normal text-gray-500">
            ({filteredChefs.length} affiché{filteredChefs.length !== 1 ? 's' : ''})
          </span>
        </h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-3 py-2 font-semibold text-black">E-mail</th>
                <th className="px-3 py-2 font-semibold text-black">Rôle</th>
                <th className="px-3 py-2 font-semibold text-black">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {filteredChefs.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-gray-500" colSpan={3}>
                    Aucun résultat.
                  </td>
                </tr>
              ) : (
                filteredChefs.map((row) => (
                  <tr
                    key={`f-${row.email}`}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="px-3 py-2 font-mono text-black">{row.email}</td>
                    <td className="px-3 py-2 text-gray-700">chef</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {formatWhen(row.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
