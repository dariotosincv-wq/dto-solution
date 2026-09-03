export const NACSCAN_LANGUAGES = ['it', 'en', 'es', 'fr', 'de']
const KEY = 'nacscan.settings'

export const DEFAULT_NACSCAN_WEB_PREFERENCES = { languagePreference: 'auto', defaultTextFontSize: 18, defaultTextColor: 'black' }

export function resolveNacScanLanguage(preference, browserLanguage = navigator.language) {
  if (NACSCAN_LANGUAGES.includes(preference)) return preference
  const language = browserLanguage.toLowerCase().split('-')[0]
  return NACSCAN_LANGUAGES.includes(language) ? language : 'it'
}

export function loadNacScanWebPreferences(storage = localStorage) {
  try { return { ...DEFAULT_NACSCAN_WEB_PREFERENCES, ...JSON.parse(storage.getItem(KEY) || '{}') } }
  catch { return DEFAULT_NACSCAN_WEB_PREFERENCES }
}

export function saveNacScanWebPreferences(preferences, storage = localStorage) {
  storage.setItem(KEY, JSON.stringify(preferences))
  return preferences
}

const strings = {
  it: { search: 'Cerca', searchPlaceholder: 'Parola o frase', previous: 'Precedente', next: 'Successivo', noText: 'Questo PDF non contiene testo digitale ricercabile. L’OCR non è disponibile in questa versione web.', noResults: 'Nessun risultato trovato.', language: 'Lingua', automatic: 'Automatica', signatures: 'Firme salvate', manageSignatures: 'Gestisci firme', saveFolder: 'Cartella di salvataggio', chooseFolder: 'Cambia cartella', resetFolder: 'Ripristina predefinita', defaultFolder: 'Download del browser', drive: 'Google Drive', driveMissing: 'Per collegare Google Drive manca il Client ID OAuth Web.', connectDrive: 'Collega Google Drive', disconnectDrive: 'Scollega Google Drive' },
  en: { search: 'Search', searchPlaceholder: 'Word or phrase', previous: 'Previous', next: 'Next', noText: 'This PDF has no searchable digital text. OCR is not available in this web version.', noResults: 'No results found.', language: 'Language', automatic: 'Automatic', signatures: 'Saved signatures', manageSignatures: 'Manage signatures', saveFolder: 'Save folder', chooseFolder: 'Change folder', resetFolder: 'Reset default', defaultFolder: 'Browser downloads', drive: 'Google Drive', driveMissing: 'A Google Web OAuth Client ID is required to connect Drive.', connectDrive: 'Connect Google Drive', disconnectDrive: 'Disconnect Google Drive' },
  es: { search: 'Buscar', searchPlaceholder: 'Palabra o frase', previous: 'Anterior', next: 'Siguiente', noText: 'Este PDF no contiene texto digital buscable. Puedes probar Extraer texto.', noResults: 'No se encontraron resultados.', language: 'Idioma', automatic: 'Automático', signatures: 'Firmas guardadas', manageSignatures: 'Gestionar firmas', saveFolder: 'Carpeta de guardado', chooseFolder: 'Cambiar carpeta', resetFolder: 'Restablecer', defaultFolder: 'Descargas del navegador', drive: 'Google Drive', driveMissing: 'Falta el Client ID OAuth Web de Google.', connectDrive: 'Conectar Google Drive', disconnectDrive: 'Desconectar Google Drive' },
  fr: { search: 'Rechercher', searchPlaceholder: 'Mot ou phrase', previous: 'Précédent', next: 'Suivant', noText: 'Ce PDF ne contient aucun texte numérique recherchable. Essayez Extraire le texte.', noResults: 'Aucun résultat.', language: 'Langue', automatic: 'Automatique', signatures: 'Signatures enregistrées', manageSignatures: 'Gérer les signatures', saveFolder: 'Dossier d’enregistrement', chooseFolder: 'Changer de dossier', resetFolder: 'Réinitialiser', defaultFolder: 'Téléchargements du navigateur', drive: 'Google Drive', driveMissing: 'Le Client ID OAuth Web Google est manquant.', connectDrive: 'Connecter Google Drive', disconnectDrive: 'Déconnecter Google Drive' },
  de: { search: 'Suchen', searchPlaceholder: 'Wort oder Satz', previous: 'Zurück', next: 'Weiter', noText: 'Dieses PDF enthält keinen durchsuchbaren digitalen Text. Versuche Text extrahieren.', noResults: 'Keine Ergebnisse gefunden.', language: 'Sprache', automatic: 'Automatisch', signatures: 'Gespeicherte Signaturen', manageSignatures: 'Signaturen verwalten', saveFolder: 'Speicherordner', chooseFolder: 'Ordner ändern', resetFolder: 'Zurücksetzen', defaultFolder: 'Browser-Downloads', drive: 'Google Drive', driveMissing: 'Die Google Web OAuth Client-ID fehlt.', connectDrive: 'Google Drive verbinden', disconnectDrive: 'Google Drive trennen' },
}

export function nacScanText(language, key) { return strings[language]?.[key] || strings.it[key] || key }
