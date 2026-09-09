export const DRIVER_QR_SHARE_TEXT = 'Questo è il tuo QR personale DTO Solution. Conservalo per accedere alla tua Area Operativa e per l’utilizzo futuro con Driver Utility.'
export const driverQrLink = path => `https://www.dtosolution.it${path}`

export async function driverQrPngFile(dataUrl) {
  const blob = await fetch(dataUrl).then(response => response.blob())
  return new File([blob], 'dto-solution-qr-driver.png', { type: 'image/png' })
}

export const canShareDriverQrFile = file => typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
