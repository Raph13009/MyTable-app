'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/hooks/useTranslation'

interface BookPageTitleProps {
  chefName: string
}

export default function BookPageTitle({ chefName }: BookPageTitleProps) {
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)

  // Éviter l'erreur d'hydratation en rendant d'abord le contenu par défaut (français)
  // puis en mettant à jour après le montage
  useEffect(() => {
    setMounted(true)
  }, [])

  // Pendant l'hydratation, utiliser le français (par défaut serveur)
  // Après le montage, utiliser la locale détectée
  const title = mounted ? t('booking.title') : 'Réserver avec Chef'
  const subtitle = mounted ? t('booking.subtitle') : 'Remplissez le formulaire ci-dessous pour faire une demande de réservation'

  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-bold mb-1.5" suppressHydrationWarning>
        {title}{' '}
        <span className="text-black underline decoration-[#FBCF03] decoration-2 underline-offset-4">
          {chefName}
        </span>
      </h1>
      <p className="text-sm sm:text-base text-gray-600" suppressHydrationWarning>
        {subtitle}
      </p>
    </>
  )
}
