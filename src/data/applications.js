export const applications = [
  {
    name: 'NACScan',
    slug: 'nacscan',
    image: '/products/nacscan.png',
    imageAlt: 'Banner promozionale di NACScan',
    status: 'Disponibile su Google Play',
    detailLabel: 'Scopri NACScan',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.dariot.app.nacscan',
    logoLabel: 'Logo ufficiale NACScan',
    videoLabel: 'Video dimostrativo NACScan',
    screenshotLabel: 'Screenshot NACScan',
    screenshots: ['Screenshot 1 NACScan', 'Screenshot 2 NACScan', 'Screenshot 3 NACScan'],
  },
  {
    name: 'Shopping Voice',
    slug: 'shopping-voice',
    image: '/products/shopping-voice.png',
    imageAlt: 'Banner promozionale di Shopping Voice',
    status: 'Disponibile su Google Play',
    detailLabel: 'Scopri Shopping Voice',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.dariotosin.spesasmart',
  },
  {
    name: 'Driver Utility',
    slug: 'driver-utility',
    image: '/products/driver-utility.png',
    imageAlt: 'Banner promozionale di Driver Utility',
    status: 'In fase di sviluppo',
    badge: 'UNDER CONSTRUCTION',
    detailLabel: 'Scopri Driver Utility',
    logo: '/products/driver-utility/driver-utility-icon.png',
    logoAlt: 'Logo Driver Utility',
    hideVideo: true,
    screenshots: [
      { src: '/products/driver-utility/driver-utility-home.jpeg', label: 'Driver Utility', alt: 'Schermata principale Driver Utility' },
      { src: '/products/driver-utility/driver-utility-ispezioni.jpeg', label: 'Controlla Mezzi', alt: 'Controlla Mezzi Driver Utility' },
      { src: '/products/driver-utility/driver-utility-qr-hub.jpeg', label: 'QR Locali', alt: 'QR Locali Driver Utility' },
      { src: '/products/driver-utility/driver-utility-turni.jpeg', label: 'Turni Driver', alt: 'Turni Driver' },
      { src: '/products/driver-utility/driver-utility-busta-paga.jpeg', label: 'Busta Paga Driver', alt: 'Busta Paga Driver' },
    ],
  },
  {
    name: 'CheckVan Pro',
    slug: 'checkvan-pro',
    showInGrid: false,
    logoLabel: 'Logo ufficiale CheckVan Pro',
    videoLabel: 'Video dimostrativo CheckVan Pro',
    screenshotLabel: 'Screenshot CheckVan Pro',
    screenshots: ['Screenshot 1 CheckVan Pro', 'Screenshot 2 CheckVan Pro', 'Screenshot 3 CheckVan Pro'],
  },
]

export const getApplicationBySlug = (slug) => (
  applications.find((application) => application.slug === slug)
)
