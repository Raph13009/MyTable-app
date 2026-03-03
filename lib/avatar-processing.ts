export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_SIZE = 400
const DEFAULT_QUALITY = 0.8

const createImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Impossible de charger l image'))
    image.src = src
  })

export async function createCroppedImageFile(
  imageSrc: string,
  cropArea: CropArea,
  fileName = 'avatar.webp',
  outputSize = DEFAULT_SIZE,
  quality = DEFAULT_QUALITY
): Promise<File> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Canvas non disponible')
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.clearRect(0, 0, outputSize, outputSize)
  ctx.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    outputSize,
    outputSize
  )

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (result) => resolve(result),
      'image/webp',
      quality
    )
  })

  canvas.width = 0
  canvas.height = 0

  if (!blob) {
    throw new Error('Impossible de generer l image')
  }

  return new File([blob], fileName, { type: 'image/webp' })
}

export async function createCroppedAvatarFile(
  imageSrc: string,
  cropArea: CropArea,
  fileName = 'avatar.webp',
  outputSize = DEFAULT_SIZE,
  quality = DEFAULT_QUALITY
): Promise<File> {
  return createCroppedImageFile(imageSrc, cropArea, fileName, outputSize, quality)
}
