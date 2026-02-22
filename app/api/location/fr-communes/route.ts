import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const nom = (searchParams.get('nom') || '').trim()
    const codePostal = (searchParams.get('codePostal') || '').trim()
    const limit = (searchParams.get('limit') || '8').trim()

    if (!nom && !codePostal) {
      return NextResponse.json({ error: 'Paramètre nom ou codePostal requis' }, { status: 400 })
    }

    const upstream = new URL('https://geo.api.gouv.fr/communes')
    upstream.searchParams.set('fields', 'nom,code,codesPostaux')
    upstream.searchParams.set('limit', limit)
    if (nom) {
      upstream.searchParams.set('nom', nom)
      upstream.searchParams.set('boost', 'population')
    }
    if (codePostal) {
      upstream.searchParams.set('codePostal', codePostal)
    }

    const response = await fetch(upstream.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Erreur API communes' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erreur lors de la récupération des communes' },
      { status: 500 }
    )
  }
}
