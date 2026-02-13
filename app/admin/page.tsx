'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminMessaging from '@/components/admin/AdminMessaging'
import AdminChefs from '@/components/admin/AdminChefs'
import AdminAnalytics from '@/components/admin/AdminAnalytics'

const ADMIN_UID = '8d154623-1aba-475c-9a7b-9ab39f3f84d2'

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeSection, setActiveSection] = useState<'messaging' | 'chefs' | 'analytics'>('chefs')

  useEffect(() => {
    checkAuth()
    
    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        checkAuth()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAuth = async () => {
    try {
      setIsChecking(true)
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) throw userError
      
      if (user && user.id === ADMIN_UID) {
        setIsAuthenticated(true)
      } else {
        setIsAuthenticated(false)
        // Si l'utilisateur est connecté mais n'est pas l'admin, le déconnecter
        if (user) {
          await supabase.auth.signOut()
        }
      }
    } catch (error: any) {
      console.error('Error checking auth:', error)
      setIsAuthenticated(false)
    } finally {
      setIsChecking(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: password,
      })

      if (signInError) throw signInError

      // Vérifier que l'utilisateur connecté est bien l'admin
      if (data.user?.id !== ADMIN_UID) {
        await supabase.auth.signOut()
        throw new Error('Accès non autorisé')
      }

      // Re-vérifier l'authentification
      await checkAuth()
    } catch (error: any) {
      console.error('Error signing in:', error)
      setError(error.message || 'Email ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setEmail('')
    setPassword('')
    router.push('/admin')
  }

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-600">Vérification de l&apos;authentification...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-black mb-2">Administration</h1>
            <p className="text-gray-600">Connectez-vous pour accéder au panneau d&apos;administration</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FBCF03] focus:border-transparent"
                placeholder="votre@email.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FBCF03] focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FBCF03] text-black font-semibold py-2.5 rounded-lg hover:bg-[#E6BA00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header fixe - Jaune avec logo */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#FBCF03] border-b-2 border-black shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-4">
              <img 
                src="/logo-banner.jpeg" 
                alt="MyTable" 
                className="h-10 sm:h-12 w-auto object-contain"
              />
              <h1 className="text-lg sm:text-xl font-bold text-black hidden sm:block">Administration</h1>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-semibold text-black bg-white/90 hover:bg-white border-2 border-black rounded-lg transition-all shadow-sm hover:shadow-md"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Navigation fixe sous le header */}
      <div className="fixed top-16 sm:top-20 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveSection('chefs')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeSection === 'chefs'
                  ? 'border-[#FBCF03] text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Gestion des chefs
            </button>
            <button
              onClick={() => setActiveSection('messaging')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeSection === 'messaging'
                  ? 'border-[#FBCF03] text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Messagerie
            </button>
            <button
              onClick={() => setActiveSection('analytics')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeSection === 'analytics'
                  ? 'border-[#FBCF03] text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Analytics
            </button>
          </nav>
        </div>
      </div>

      {/* Content avec padding pour les headers fixes */}
      <div className="pt-32 sm:pt-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeSection === 'messaging' ? (
          <AdminMessaging />
        ) : activeSection === 'analytics' ? (
          <AdminAnalytics />
        ) : (
          <AdminChefs />
        )}
        </div>
      </div>
    </div>
  )
}
