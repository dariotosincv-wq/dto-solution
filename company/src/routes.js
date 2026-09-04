export const COMPANY_BASE_PATH = '/azienda'

export const COMPANY_ROUTES = Object.freeze({
  login: `${COMPANY_BASE_PATH}/login`,
  dashboard: `${COMPANY_BASE_PATH}/dashboard`,
  checkvan: `${COMPANY_BASE_PATH}/checkvan`,
  inspections: `${COMPANY_BASE_PATH}/ispezioni`,
  verifyPdf: `${COMPANY_BASE_PATH}/pdf/verifica`,
  comparePdf: `${COMPANY_BASE_PATH}/pdf/confronta`,
  devices: `${COMPANY_BASE_PATH}/dispositivi`,
  vehicles: `${COMPANY_BASE_PATH}/veicoli`,
  drivers: `${COMPANY_BASE_PATH}/driver`,
  assignments: `${COMPANY_BASE_PATH}/assegnazioni`,
  vehicle: (id) => `${COMPANY_BASE_PATH}/veicoli/${id}`,
  account: `${COMPANY_BASE_PATH}/account`,
})
