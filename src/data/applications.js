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
    logoLabel: 'Logo ufficiale Driver Utility',
    videoLabel: 'Video dimostrativo Driver Utility',
    screenshotLabel: 'Screenshot Driver Utility',
    screenshots: [
      'Screenshot 1 Driver Utility',
      'Screenshot 2 Driver Utility',
      'Screenshot 3 Driver Utility',
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
