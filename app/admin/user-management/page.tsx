'use client'

import { useState } from 'react'

interface UserStatus {
  exists?: boolean
  created?: boolean
  userId?: string
  email?: string
  message?: string
  success?: boolean
  userInfo?: {
    id: string
    email: string
    emailConfirmed: boolean
    createdAt: string
    lastSignIn: string | null
  }
  chefData?: {
    email: string
    name: string
    last_name: string | null
  }
  error?: string
  details?: string
}

export default function AdminUserManagement() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UserStatus | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)

    try {
      const normalizedEmail = email.toLowerCase().trim()
      const response = await fetch(
        `/api/admin/reset-user-password?email=${encodeURIComponent(normalizedEmail)}`
      )
      
      const data = await response.json()
      
      if (!response.ok && data.error) {
        setError(data.error + (data.details ? `: ${data.details}` : ''))
      } else {
        setResult(data)
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-black mb-2">
            🔧 Gestion des utilisateurs
          </h1>
          <p className="text-gray-600 mb-8">
            Diagnostiquer et réinitialiser les comptes utilisateurs
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 mb-8">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email de l'utilisateur
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FBCF03] focus:border-transparent outline-none"
                placeholder="ryad932@outlook.com"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-[#FBCF03] text-black font-semibold py-3 rounded-lg hover:bg-[#E6BA00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Vérification en cours...' : 'Vérifier et réinitialiser'}
            </button>
          </form>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-red-800 mb-1">❌ Erreur</h3>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Success Message */}
              {result.success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-2">✅ Email envoyé avec succès</h3>
                  <p className="text-sm text-green-700 mb-2">{result.message}</p>
                  <p className="text-xs text-green-600">
                    L'utilisateur doit vérifier son email (y compris le dossier spam).
                  </p>
                </div>
              )}

              {/* User Created */}
              {result.created && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800 mb-2">🆕 Compte créé</h3>
                  <p className="text-sm text-blue-700 mb-2">{result.message}</p>
                  <div className="text-xs text-blue-600 space-y-1">
                    <p><strong>Email:</strong> {result.email}</p>
                    <p><strong>User ID:</strong> {result.userId}</p>
                  </div>
                </div>
              )}

              {/* User Not Found */}
              {result.exists === false && !result.created && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Utilisateur introuvable</h3>
                  <p className="text-sm text-yellow-700">{result.message}</p>
                </div>
              )}

              {/* User Info */}
              {result.userInfo && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">📋 Informations utilisateur</h3>
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <span className="text-gray-600">Email:</span>
                      <span className="font-mono text-gray-900">{result.userInfo.email}</span>
                      
                      <span className="text-gray-600">ID:</span>
                      <span className="font-mono text-xs text-gray-900">{result.userInfo.id}</span>
                      
                      <span className="text-gray-600">Email confirmé:</span>
                      <span className={result.userInfo.emailConfirmed ? 'text-green-600' : 'text-red-600'}>
                        {result.userInfo.emailConfirmed ? '✅ Oui' : '❌ Non'}
                      </span>
                      
                      <span className="text-gray-600">Créé le:</span>
                      <span className="text-gray-900">
                        {new Date(result.userInfo.createdAt).toLocaleString('fr-FR')}
                      </span>
                      
                      <span className="text-gray-600">Dernière connexion:</span>
                      <span className="text-gray-900">
                        {result.userInfo.lastSignIn 
                          ? new Date(result.userInfo.lastSignIn).toLocaleString('fr-FR')
                          : 'Jamais'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Chef Data */}
              {result.chefData && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-800 mb-3">👨‍🍳 Données chef</h3>
                  <div className="space-y-1 text-sm">
                    <p><strong>Nom:</strong> {result.chefData.name} {result.chefData.last_name || ''}</p>
                    <p><strong>Email:</strong> {result.chefData.email}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">ℹ️ Comment ça marche</h3>
            <div className="text-sm text-blue-700 space-y-2">
              <p>Cet outil effectue les actions suivantes :</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Vérifie si l'utilisateur existe dans <code>auth.users</code></li>
                <li>Vérifie si le chef existe dans la table <code>chefs</code></li>
                <li>Crée automatiquement le compte auth si nécessaire</li>
                <li>Envoie un email de réinitialisation de mot de passe</li>
              </ul>
              <p className="mt-3 text-xs">
                <strong>Note:</strong> L'utilisateur recevra un email avec un lien pour créer/réinitialiser son mot de passe.
                Le lien expire après 1 heure.
              </p>
            </div>
          </div>

          {/* Common Issues */}
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Problèmes courants avec Outlook</h3>
            <div className="text-sm text-yellow-700 space-y-1">
              <p>Si l'utilisateur utilise Outlook et ne reçoit pas l'email :</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Vérifier le dossier <strong>Courrier indésirable</strong></li>
                <li>Vérifier le dossier <strong>Autres</strong></li>
                <li>L'email peut prendre jusqu'à 5-10 minutes pour arriver</li>
                <li>Les filtres Outlook peuvent bloquer l'email</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
