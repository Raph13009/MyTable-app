'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Chef {
  id: string
  slug: string
  name: string
  email: string
  phone: string | null
  city: string | null
  postal_code: string | null
  profile_picture: string | null
  created_at: string
  menus?: Menu[]
}

interface Menu {
  id: string
  chef_id: string
  name: string
  description: string | null
  price: number | null
}

export default function AdminChefs() {
  const router = useRouter()
  const [chefs, setChefs] = useState<Chef[]>([])
  const [loading, setLoading] = useState(true)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [chefLink, setChefLink] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchChefs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchChefs = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('chefs')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Récupérer les menus pour chaque chef
      const chefsWithMenus = await Promise.all(
        (data || []).map(async (chef: any) => {
          const { data: menusData } = await supabase
            .from('menus')
            .select('*')
            .eq('chef_id', chef.id)

          return {
            ...(chef as any),
            menus: menusData || [],
          }
        })
      )

      setChefs(chefsWithMenus as Chef[])
    } catch (error) {
      console.error('Error fetching chefs:', error)
      alert('Erreur lors du chargement des chefs')
    } finally {
      setLoading(false)
    }
  }


  const handleDelete = async (chefId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce chef ?')) return

    try {
      // Supprimer les menus
      await supabase.from('menus').delete().eq('chef_id', chefId)

      // Supprimer le chef
      const { error } = await supabase.from('chefs').delete().eq('id', chefId)

      if (error) throw error

      fetchChefs()
    } catch (error) {
      console.error('Error deleting chef:', error)
      alert('Erreur lors de la suppression')
    }
  }

  const handleEdit = (chef: Chef) => {
    router.push(`/admin/chef-form?id=${chef.id}`)
  }

  const handleShowLink = (chef: Chef) => {
    const link = `https://www.guidemytable.fr/book/${chef.slug}`
    setChefLink(link)
    setShowLinkModal(true)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(chefLink)
    alert('Lien copié dans le presse-papier !')
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Chargement...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-black">Gestion des chefs</h2>
        <button
          onClick={() => router.push('/admin/chef-form')}
          className="px-4 py-2 bg-[#FBCF03] text-black font-semibold rounded-lg hover:bg-[#E6BA00] transition-colors"
        >
          Ajouter un chef
        </button>
      </div>

      {/* Liste des chefs - Style Instagram moderne 2025 */}
      <div className="space-y-2">
        {chefs.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-gray-100">
                <p className="text-gray-400 text-sm">Aucun chef enregistr&eacute;</p>
          </div>
        ) : (
          chefs.map((chef) => (
            <div
              key={chef.id}
              className="group flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-200"
            >
              {/* Avatar - Left, Circle */}
              <div className="flex-shrink-0">
                {chef.profile_picture ? (
                  <img
                    src={chef.profile_picture}
                    alt={chef.name}
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-50 shadow-sm"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center ring-2 ring-gray-50 shadow-sm">
                    <span className="text-lg font-semibold text-gray-700">
                      {chef.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Main Info - Center, Vertical alignment like Instagram DM */}
              <div className="flex-1 min-w-0">
                {/* Chef name - Single line, clearly readable */}
                <h3 className="text-base font-semibold text-black leading-tight mb-1.5 truncate">
                  {chef.name}
                </h3>
                
                {/* City + postal code - One line below, lighter text */}
                {chef.city && (
                  <p className="text-sm text-gray-500 leading-tight mb-1.5 truncate">
                    {chef.city}{chef.postal_code && ` ${chef.postal_code}`}
                  </p>
                )}
                
                {/* Menu count - Subtle badge */}
                <div className="inline-flex items-center">
                  <span className="text-xs text-gray-400 font-medium">
                    {chef.menus?.length || 0} {chef.menus?.length === 1 ? 'menu' : 'menus'}
                  </span>
                </div>
              </div>

              {/* Actions - Right, Icon-based, Secondary/Muted style */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => handleShowLink(chef)}
                  className="p-2 text-gray-400 hover:text-[#FBCF03] hover:bg-[#FBCF03]/10 rounded-lg transition-all duration-200"
                  title="Voir le lien"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => handleEdit(chef)}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-all duration-200"
                  title="Modifier"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(chef.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                  title="Supprimer"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal pour afficher le lien */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-black">Lien du formulaire</h3>
              <button
                onClick={() => setShowLinkModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lien vers le formulaire de réservation
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chefLink}
                    readOnly
                    className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FBCF03]/30 focus:border-[#FBCF03]"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="px-4 py-2.5 bg-[#FBCF03] text-black font-semibold rounded-xl hover:bg-[#E6BA00] transition-colors whitespace-nowrap"
                  >
                    Copier
                  </button>
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => window.open(chefLink, '_blank')}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Ouvrir le lien
                </button>
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

