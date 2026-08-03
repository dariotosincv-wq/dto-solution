export const applications = [
  {
    name: 'NACScan',
    slug: 'nacscan',
    logoLabel: 'Logo ufficiale NACScan',
    videoLabel: 'Video dimostrativo NACScan',
    screenshotLabel: 'Screenshot NACScan',
    screenshots: ['Screenshot 1 NACScan', 'Screenshot 2 NACScan', 'Screenshot 3 NACScan'],
  },
  {
    name: 'Driver Utility',
    slug: 'driver-utility',
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
    logoLabel: 'Logo ufficiale CheckVan Pro',
    videoLabel: 'Video dimostrativo CheckVan Pro',
    screenshotLabel: 'Screenshot CheckVan Pro',
    screenshots: ['Screenshot 1 CheckVan Pro', 'Screenshot 2 CheckVan Pro', 'Screenshot 3 CheckVan Pro'],
  },
]

export const getApplicationBySlug = (slug) => (
  applications.find((application) => application.slug === slug)
)
