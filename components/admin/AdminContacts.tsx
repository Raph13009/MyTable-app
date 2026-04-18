'use client'

import { useCallback, useEffect, useState } from 'react'

type ContactsPayload = {
  clientEmails: string[]
  chefEmails: string[]
}

export default function AdminContacts() {
  const [data, setData] = useState<ContactsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/admin/contacts')
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Impossible de charger les contacts')
        }
        const json = (await res.json()) as ContactsPayload
        if (!cancelled) setData(json)
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

  const copyText = useCallback(async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      window.setTimeout(() => setCopied((c) => (c === label ? null : c)), 2000)
    } catch {
      setCopied('erreur')
      window.setTimeout(() => setCopied(null), 2000)
    }
  }, [])

  const clientsText = data?.clientEmails.join('\n') ?? ''
  const chefsText = data?.chefEmails.join('\n') ?? ''
  const allText =
    data == null
      ? ''
      : [
          '--- Clients ---',
          clientsText,
          '',
          '--- Chefs ---',
          chefsText,
        ].join('\n')

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-600 shadow-sm">
        Chargement des contacts…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-black">Contacts</h2>
        <p className="mt-1 text-sm text-gray-600">
          E-mails issus des demandes de réservation et des conversations (clients) et de la
          fiche chef (chefs). Un clic copie la liste dans le presse-papiers — à coller dans un
          tableur ou un outil d’e-mailing.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => copyText('all', allText)}
          className="rounded-lg border-2 border-black bg-[#FBCF03] px-4 py-2 text-sm font-semibold text-black shadow-sm hover:bg-[#E6BA00]"
        >
          Copier tout (clients + chefs)
        </button>
        {copied === 'all' && (
          <span className="self-center text-sm font-medium text-green-700">Copié !</span>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-black">Clients</h3>
            <span className="text-sm text-gray-500">
              {data?.clientEmails.length ?? 0} adresse(s)
            </span>
          </div>
          <textarea
            readOnly
            rows={16}
            value={clientsText}
            className="mb-3 w-full flex-1 resize-y rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm text-black"
            aria-label="Liste des e-mails clients"
          />
          <button
            type="button"
            onClick={() => copyText('clients', clientsText)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-50"
          >
            Copier les e-mails clients
          </button>
          {copied === 'clients' && (
            <p className="mt-2 text-sm text-green-700">Copié !</p>
          )}
        </section>

        <section className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-black">Chefs</h3>
            <span className="text-sm text-gray-500">
              {data?.chefEmails.length ?? 0} adresse(s)
            </span>
          </div>
          <textarea
            readOnly
            rows={16}
            value={chefsText}
            className="mb-3 w-full flex-1 resize-y rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm text-black"
            aria-label="Liste des e-mails chefs"
          />
          <button
            type="button"
            onClick={() => copyText('chefs', chefsText)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-50"
          >
            Copier les e-mails chefs
          </button>
          {copied === 'chefs' && (
            <p className="mt-2 text-sm text-green-700">Copié !</p>
          )}
        </section>
      </div>
    </div>
  )
}
