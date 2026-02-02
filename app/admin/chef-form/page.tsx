'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Menu {
  id: string
  chef_id: string
  name: string
  description: string | null
  price: number | null
}

export default function ChefFormPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const chefId = searchParams.get('id')
  const isEditing = !!chefId
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
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
  const [currentProfilePicture, setCurrentProfilePicture] = useState<string | null>(null)
  const isSubmittingRef = useRef(false)

  useEffect(() => {
    if (isEditing && chefId) {
      fetchChefData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chefId, isEditing])

  const fetchChefData = async () => {
    if (!chefId) return
    try {
      setLoading(true)
      const { data: chef, error } = await supabase
        .from('chefs')
        .select('*')
        .eq('id', chefId)
        .single()

      if (error) throw error

      const chefData = chef as any
      setFormData({
        name: chefData.name || '',
        email: chefData.email || '',
        emailConfirm: chefData.email || '',
        phone: chefData.phone || '',
        city: chefData.city || '',
        postal_code: chefData.postal_code || '',
        profile_picture: null,
      })
      setCurrentProfilePicture(chefData.profile_picture)

      // Récupérer les menus
      const { data: menusData } = await supabase
        .from('menus')
        .select('*')
        .eq('chef_id', chefId!)

      setMenus(menusData || [])
    } catch (error) {
      console.error('Error fetching chef:', error)
      alert('Erreur lors du chargement du chef')
      router.push('/admin?section=chefs')
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
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true

    if (formData.email !== formData.emailConfirm) {
      alert('Les emails ne correspondent pas')
      isSubmittingRef.current = false
      return
    }

    try {
      setLoading(true)
      const slug = formData.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

      let profilePictureUrl = currentProfilePicture
      if (formData.profile_picture) {
        const tempId = chefId || crypto.randomUUID()
        const uploadedUrl = await uploadProfilePicture(formData.profile_picture, tempId)
        if (uploadedUrl) {
          profilePictureUrl = uploadedUrl
        }
      }

      if (isEditing && chefId) {
        // Mettre à jour le chef via API
        const response = await fetch('/api/admin/update-chef', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chefId: chefId!,
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

      router.push('/admin?section=chefs')
    } catch (error: any) {
      console.error('Error saving chef:', error)
      alert(error.message || 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
      isSubmittingRef.current = false
    }
  }

  const addMenu = () => {
    if (!newMenu.name.trim()) return
    setMenus((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        chef_id: chefId || 'temp',
        name: newMenu.name,
        description: newMenu.description || null,
        price: newMenu.price ? parseFloat(newMenu.price) : null,
      },
    ])
    setNewMenu({ name: '', description: '', price: '' })
  }

  const removeMenu = (menuId: string) => {
    setMenus((prev) => prev.filter((menu) => menu.id !== menuId))
  }

  if (loading && isEditing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin?section=chefs')}
                className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Retour"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl sm:text-3xl font-bold text-black">
                {isEditing ? 'Modifier le chef' : 'Ajouter un chef'}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 sm:p-8 lg:p-12 space-y-8 sm:space-y-10">
            {/* Photo de profil */}
            <div className="space-y-4">
              <label className="block text-base sm:text-lg font-semibold text-black">
                Photo de profil
              </label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="flex-shrink-0">
                  {formData.profile_picture ? (
                    <img
                      src={URL.createObjectURL(formData.profile_picture)}
                      alt="Preview"
                      className="w-32 h-32 rounded-full object-cover border-4 border-gray-100 shadow-md"
                    />
                  ) : currentProfilePicture ? (
                    <img
                      src={currentProfilePicture}
                      alt="Current"
                      className="w-32 h-32 rounded-full object-cover border-4 border-gray-100 shadow-md"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center border-4 border-gray-100 shadow-md">
                      <span className="text-4xl font-semibold text-gray-700">👨‍🍳</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 w-full">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-[#FBCF03] focus:border-[#FBCF03] transition-all"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Format recommandé : JPG, PNG. Taille max : 5MB
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-8"></div>

            {/* Informations de base */}
            <div className="space-y-6 sm:space-y-8">
              <h2 className="text-xl sm:text-2xl font-bold text-black">Informations de base</h2>
              
              <div>
                <label className="block text-base sm:text-lg font-semibold text-black mb-3">
                  Nom du chef *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-5 py-4 text-base sm:text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FBCF03] focus:border-[#FBCF03] transition-all"
                  placeholder="Ex: Jean Dupont"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                <div>
                  <label className="block text-base sm:text-lg font-semibold text-black mb-3">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-5 py-4 text-base sm:text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FBCF03] focus:border-[#FBCF03] transition-all"
                    placeholder="chef@example.com"
                  />
                </div>
                <div>
                  <label className="block text-base sm:text-lg font-semibold text-black mb-3">
                    Confirmer l&apos;email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.emailConfirm}
                    onChange={(e) => setFormData({ ...formData, emailConfirm: e.target.value })}
                    className="w-full px-5 py-4 text-base sm:text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FBCF03] focus:border-[#FBCF03] transition-all"
                    placeholder="chef@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                <div>
                  <label className="block text-base sm:text-lg font-semibold text-black mb-3">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-5 py-4 text-base sm:text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FBCF03] focus:border-[#FBCF03] transition-all"
                    placeholder="+33 6 12 34 56 78"
                  />
                </div>
                <div>
                  <label className="block text-base sm:text-lg font-semibold text-black mb-3">
                    Code postal
                  </label>
                  <input
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    className="w-full px-5 py-4 text-base sm:text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FBCF03] focus:border-[#FBCF03] transition-all"
                    placeholder="75001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-base sm:text-lg font-semibold text-black mb-3">
                  Ville
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-5 py-4 text-base sm:text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FBCF03] focus:border-[#FBCF03] transition-all"
                  placeholder="Paris"
                />
              </div>
            </div>

            <div className="border-t border-gray-200 pt-8"></div>

            {/* Menus */}
            <div className="space-y-6 sm:space-y-8">
              <h2 className="text-xl sm:text-2xl font-bold text-black">Menus</h2>
              
              {menus.length > 0 && (
                <div className="space-y-4">
                  {menus.map((menu) => (
                    <div
                      key={menu.id}
                      className="p-6 sm:p-8 bg-gray-50 rounded-xl border-2 border-gray-200"
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg sm:text-xl font-bold text-black mb-3">
                            {menu.name}
                          </h3>
                          {menu.description && (
                            <p className="text-base sm:text-lg text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">
                              {menu.description}
                            </p>
                          )}
                          {menu.price && (
                            <p className="text-lg sm:text-xl font-semibold text-black">
                              {menu.price.toFixed(2)} €
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMenu(menu.id)}
                          className="flex-shrink-0 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Supprimer le menu"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulaire d'ajout de menu */}
              <div className="p-6 sm:p-8 bg-[#FBCF03]/10 rounded-xl border-2 border-[#FBCF03]/30">
                <h3 className="text-lg sm:text-xl font-semibold text-black mb-6">
                  Ajouter un menu
                </h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-base font-semibold text-black mb-3">
                      Nom du menu *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Menu Découverte"
                      value={newMenu.name}
                      onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })}
                      className="w-full px-5 py-4 text-base sm:text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FBCF03] focus:border-[#FBCF03] transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-base font-semibold text-black mb-3">
                      Description
                    </label>
                    <textarea
                      placeholder="Décrivez le menu en détail..."
                      value={newMenu.description}
                      onChange={(e) => setNewMenu({ ...newMenu, description: e.target.value })}
                      rows={6}
                      className="w-full px-5 py-4 text-base sm:text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FBCF03] focus:border-[#FBCF03] transition-all resize-y"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-base font-semibold text-black mb-3">
                        Prix (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newMenu.price}
                        onChange={(e) => setNewMenu({ ...newMenu, price: e.target.value })}
                        className="w-full px-5 py-4 text-base sm:text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FBCF03] focus:border-[#FBCF03] transition-all"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={addMenu}
                        disabled={!newMenu.name.trim()}
                        className="w-full px-6 py-4 bg-[#FBCF03] text-black font-bold text-base sm:text-lg rounded-xl hover:bg-[#E6BA00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Ajouter le menu
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-gray-200 pt-8">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                <button
                  type="button"
                  onClick={() => router.push('/admin?section=chefs')}
                  className="flex-1 px-6 py-4 text-base sm:text-lg font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading || uploading}
                  className="flex-1 px-6 py-4 text-base sm:text-lg font-bold bg-[#FBCF03] text-black rounded-xl hover:bg-[#E6BA00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Upload...' : loading ? 'Enregistrement...' : isEditing ? 'Enregistrer les modifications' : 'Créer le chef'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
