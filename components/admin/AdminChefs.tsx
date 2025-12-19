'use client'

import { useState, useEffect } from 'react'
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
  const [chefs, setChefs] = useState<Chef[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingChef, setEditingChef] = useState<Chef | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    emailConfirm: '',
    phone: '',
    city: '',
    postal_code: '',
    profile_picture: null as File | null,
  })
  const [menus, setMenus] = useState<Menu[]>([])
  const [newMenu, setNewMenu] = useState({ name: '', description: '', price: '' })
  const [uploading, setUploading] = useState(false)
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
        (data || []).map(async (chef) => {
          const { data: menusData } = await supabase
            .from('menus')
            .select('*')
            .eq('chef_id', chef.id)

          return {
            ...chef,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, profile_picture: e.target.files[0] })
    }
  }

  const uploadProfilePicture = async (file: File, chefId: string): Promise<string | null> => {
    try {
      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${chefId}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `chef-profiles/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('chef-profiles')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('chef-profiles').getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading profile picture:', error)
      alert('Erreur lors de l\'upload de la photo')
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.email !== formData.emailConfirm) {
      alert('Les emails ne correspondent pas')
      return
    }

    try {
      const slug = formData.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

      let profilePictureUrl = null
      if (formData.profile_picture) {
        // Pour l'édition, on utilise l'ID existant, sinon on génère un ID temporaire
        const tempId = editingChef?.id || crypto.randomUUID()
        profilePictureUrl = await uploadProfilePicture(formData.profile_picture, tempId)
        if (!profilePictureUrl && editingChef) {
          profilePictureUrl = editingChef.profile_picture
        }
      } else if (editingChef) {
        profilePictureUrl = editingChef.profile_picture
      }

      if (editingChef) {
        // Mettre à jour le chef via API
        const response = await fetch('/api/admin/update-chef', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chefId: editingChef.id,
            slug,
            name: formData.name,
            email: formData.email.toLowerCase().trim(),
            phone: formData.phone || null,
            city: formData.city || null,
            postal_code: formData.postal_code || null,
            profile_picture: profilePictureUrl,
            menus,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Erreur lors de la mise à jour')
        }
      } else {
        // Créer un nouveau chef via API
        const response = await fetch('/api/admin/create-chef', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            name: formData.name,
            email: formData.email.toLowerCase().trim(),
            phone: formData.phone || null,
            city: formData.city || null,
            postal_code: formData.postal_code || null,
            profile_picture: profilePictureUrl,
            menus,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Erreur lors de la création')
        }
      }

      // Réinitialiser le formulaire
      setFormData({
        name: '',
        email: '',
        emailConfirm: '',
        phone: '',
        city: '',
        postal_code: '',
        profile_picture: null,
      })
      setMenus([])
      setNewMenu({ name: '', description: '', price: '' })
      setShowAddModal(false)
      setEditingChef(null)
      fetchChefs()
    } catch (error: any) {
      console.error('Error saving chef:', error)
      alert(error.message || 'Erreur lors de la sauvegarde')
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
    setEditingChef(chef)
    setFormData({
      name: chef.name,
      email: chef.email,
      emailConfirm: chef.email,
      phone: chef.phone || '',
      city: chef.city || '',
      postal_code: chef.postal_code || '',
      profile_picture: null,
    })
    setMenus(chef.menus || [])
    setShowAddModal(true)
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

  const addMenu = () => {
    if (!newMenu.name.trim()) return
    setMenus([
      ...menus,
      {
        id: crypto.randomUUID(),
        chef_id: editingChef?.id || '',
        name: newMenu.name,
        description: newMenu.description || null,
        price: newMenu.price ? parseFloat(newMenu.price) : null,
      },
    ])
    setNewMenu({ name: '', description: '', price: '' })
  }

  const removeMenu = (index: number) => {
    setMenus(menus.filter((_, i) => i !== index))
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
          onClick={() => {
            setEditingChef(null)
            setFormData({
              name: '',
              email: '',
              emailConfirm: '',
              phone: '',
              city: '',
              postal_code: '',
              profile_picture: null,
            })
            setMenus([])
            setNewMenu({ name: '', description: '', price: '' })
            setShowAddModal(true)
          }}
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

      {/* Modal Ajouter/Modifier */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-black mb-6">
                {editingChef ? 'Modifier le chef' : 'Ajouter un chef'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Photo de profil
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  {editingChef?.profile_picture && !formData.profile_picture && (
                    <img
                      src={editingChef.profile_picture}
                      alt="Current"
                      className="w-20 h-20 rounded-full object-cover mt-2"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FBCF03] focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FBCF03] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirmer l&apos;email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.emailConfirm}
                      onChange={(e) => setFormData({ ...formData, emailConfirm: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FBCF03] focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FBCF03] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Code postal
                    </label>
                    <input
                      type="text"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FBCF03] focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ville
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FBCF03] focus:border-transparent"
                  />
                </div>

                {/* Menus */}
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-semibold text-black mb-3">Menus</h4>
                  {menus.map((menu, index) => (
                    <div key={index} className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{menu.name}</p>
                        {menu.description && (
                          <p className="text-xs text-gray-500">{menu.description}</p>
                        )}
                        {menu.price && <p className="text-xs text-gray-600">{menu.price} €</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMenu(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <input
                      type="text"
                      placeholder="Nom du menu"
                      value={newMenu.name}
                      onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Description"
                      value={newMenu.description}
                      onChange={(e) => setNewMenu({ ...newMenu, description: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Prix"
                        value={newMenu.price}
                        onChange={(e) => setNewMenu({ ...newMenu, price: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <button
                        type="button"
                        onClick={addMenu}
                        className="px-4 py-2 bg-[#FBCF03] text-black font-medium rounded-lg hover:bg-[#E6BA00] transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      setEditingChef(null)
                    }}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 px-4 py-2 bg-[#FBCF03] text-black font-semibold rounded-lg hover:bg-[#E6BA00] transition-colors disabled:opacity-50"
                  >
                    {uploading ? 'Upload...' : editingChef ? 'Modifier' : 'Ajouter'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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

