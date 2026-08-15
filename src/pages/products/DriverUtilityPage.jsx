import AndroidProductPage from '../../components/products/AndroidProductPage.jsx'
import ButtonLink from '../../components/common/ButtonLink.jsx'
import { getApplicationBySlug } from '../../data/applications.js'
import { useI18n } from '../../i18n/useI18n.js'

const product = getApplicationBySlug('driver-utility')

function DriverUtilityPage() {
  const { t } = useI18n()

  return (
    <AndroidProductPage product={product}>
      <section className="product-download" aria-labelledby="checkvan-verification-title">
        <div>
          <p className="eyebrow">{t('Verifica CheckVan', 'CheckVan verification')}</p>
          <h2 id="checkvan-verification-title">
            {t('Controlla un documento CheckVan', 'Check a CheckVan document')}
          </h2>
          <p>{t(
            'Verifica localmente se un PDF corrisponde a un documento registrato da Driver Utility.',
            'Check locally whether a PDF matches a document registered by Driver Utility.',
          )}</p>
        </div>
        <ButtonLink to="/verifica-checkvan">
          {t('Verifica documento CheckVan', 'Verify CheckVan document')}
        </ButtonLink>
      </section>
    </AndroidProductPage>
  )
}

export default DriverUtilityPage
