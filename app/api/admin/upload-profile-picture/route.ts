import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const ADMIN_UID = '8d154623-1aba-475c-9a7b-9ab39f3f84d2'

export async function POST(request: NextRequest) {
  try {
    // Vérifier que l'utilisateur est l'admin
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user || user.id !== ADMIN_UID) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 403 }
      )
    }
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    const chefId = formData.get('chefId') as string

    if (!file || !chefId) {
      return NextResponse.json({ error: 'File and chefId are required' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    const fileExt = file.name.split('.').pop()
    const fileName = `${chefId}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `chef-profiles/${fileName}`

    // Convertir File en ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabaseAdmin.storage
      .from('chef-profiles')
      .upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (uploadError) {
      throw uploadError
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from('chef-profiles').getPublicUrl(filePath)

    return NextResponse.json({ url: publicUrl })
  } catch (error: any) {
    console.error('Error uploading profile picture:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'upload' },
      { status: 500 }
    )
  }
}

