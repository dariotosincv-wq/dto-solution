import { Route, Routes } from 'react-router-dom'
import { SupabaseAuthProvider } from './auth/SupabaseAuthProvider.jsx'
import PageLayout from './components/layout/PageLayout.jsx'
import AboutPage from './pages/AboutPage.jsx'
import ApplicationsPage from './pages/ApplicationsPage.jsx'
import ContactPage from './pages/ContactPage.jsx'
import CcnlLogisticaPage from './pages/CcnlLogisticaPage.jsx'
import DriverAreaPage from './pages/DriverAreaPage.jsx'
import AccordoAssoespressiPage from './pages/AccordoAssoespressiPage.jsx'
import HomePage from './pages/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'
import CheckVanProPrivacyPage from './pages/privacy/CheckVanProPrivacyPage.jsx'
import DriverUtilityPrivacyPage from './pages/privacy/DriverUtilityPrivacyPage.jsx'
import NacScanPrivacyPage from './pages/privacy/NacScanPrivacyPage.jsx'
import ShoppingVoicePrivacyPage from './pages/privacy/ShoppingVoicePrivacyPage.jsx'
import WebsitePrivacyPage from './pages/privacy/WebsitePrivacyPage.jsx'
import CheckVanProPage from './pages/products/CheckVanProPage.jsx'
import DriverUtilityPage from './pages/products/DriverUtilityPage.jsx'
import NacScanPage from './pages/products/NacScanPage.jsx'
import NacScanWebPage from './pages/NacScanWebPage.jsx'
import ObservaPokerPage from './pages/products/ObservaPokerPage.jsx'
import ShoppingVoicePage from './pages/products/ShoppingVoicePage.jsx'
import CompanyApp from '../company/src/App.jsx'
import EntitiesApp from '../entities/src/App.jsx'

function App() {
  return (
    <SupabaseAuthProvider>
      <Routes>
        <Route path="azienda/*" element={<CompanyApp />} />
        <Route path="enti/*" element={<EntitiesApp />} />
        <Route element={<PageLayout />}>
          <Route index element={<HomePage />} />
          <Route path="applicazioni" element={<ApplicationsPage />} />
          <Route path="applicazioni/nacscan" element={<NacScanPage />} />
          <Route path="nacscan" element={<NacScanWebPage />} />
          <Route path="applicazioni/nacscan/privacy" element={<NacScanPrivacyPage />} />
          <Route path="applicazioni/shopping-voice" element={<ShoppingVoicePage />} />
          <Route path="applicazioni/shopping-voice/privacy" element={<ShoppingVoicePrivacyPage />} />
          <Route path="applicazioni/driver-utility" element={<DriverUtilityPage />} />
          <Route path="applicazioni/driver-utility/privacy" element={<DriverUtilityPrivacyPage />} />
          <Route path="area-driver" element={<DriverAreaPage />} />
          <Route path="area-driver/ccnl-logistica-trasporto-merci-spedizione" element={<CcnlLogisticaPage />} />
          <Route path="area-driver/accordo-asso-espressi-ultimo-miglio-2025" element={<AccordoAssoespressiPage />} />
          <Route path="applicazioni/checkvan-pro" element={<CheckVanProPage />} />
          <Route path="applicazioni/checkvan-pro/privacy" element={<CheckVanProPrivacyPage />} />
          <Route path="software/observa-poker" element={<ObservaPokerPage />} />
          <Route path="chi-siamo" element={<AboutPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="privacy/sito-web" element={<WebsitePrivacyPage />} />
          <Route path="contatti" element={<ContactPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </SupabaseAuthProvider>
  )
}

export default App
