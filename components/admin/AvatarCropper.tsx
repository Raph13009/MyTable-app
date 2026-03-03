'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Cropper, { Area } from 'react-easy-crop'
import { createCroppedImageFile } from '@/lib/avatar-processing'

interface AvatarCropperProps {
  isOpen: boolean
  imageSrc: string | null
  onClose: () => void
  onSave: (file: File) => void
  cropShape?: 'round' | 'rect'
  title?: string
  subtitle?: string
  outputFileName?: string
  outputSize?: number
  outputQuality?: number
  saveLabel?: string
}

export default function AvatarCropper({
  isOpen,
  imageSrc,
  onClose,
  onSave,
  cropShape = 'round',
  title = "Recadrer l'image",
  subtitle = 'Ajustez le cadrage pour la photo de profil',
  outputFileName = 'avatar.webp',
  outputSize = 400,
  outputQuality = 0.8,
  saveLabel = 'Valider',
}: AvatarCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const canSave = useMemo(() => Boolean(imageSrc) && Boolean(croppedAreaPixels) && !isSaving, [croppedAreaPixels, imageSrc, isSaving])

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  useEffect(() => {
    if (!isOpen || !imageSrc) return
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }, [isOpen, imageSrc])

  const handleMediaLoaded = useCallback(() => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }, [])

  const handleSave = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels || isSaving) return
    setIsSaving(true)
    try {
      const croppedFile = await createCroppedImageFile(
        imageSrc,
        croppedAreaPixels,
        outputFileName,
        outputSize,
        outputQuality
      )
      onSave(croppedFile)
    } catch (error) {
      console.error('Avatar crop error:', error)
    } finally {
      setIsSaving(false)
    }
  }, [croppedAreaPixels, imageSrc, isSaving, onSave, outputFileName, outputQuality, outputSize])

  if (!isOpen || !imageSrc) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-black">{title}</h3>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
            aria-label="Fermer"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[22rem] overflow-hidden rounded-xl bg-[#111111]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape={cropShape}
            showGrid={false}
            minZoom={1}
            maxZoom={3}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
            onMediaLoaded={handleMediaLoaded}
            objectFit="cover"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="avatar-zoom" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Zoom
          </label>
          <input
            id="avatar-zoom"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="w-full accent-[#FBCF03]"
          />
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setCrop({ x: 0, y: 0 })
              setZoom(1)
            }}
            className="inline-flex h-10 items-center rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reinitialiser
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="inline-flex h-10 items-center rounded-full bg-[#FBCF03] px-5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60 hover:bg-[#E8BC00]"
          >
            {isSaving ? 'Generation...' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
