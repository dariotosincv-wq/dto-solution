import ProductPrivacyLayout from '../../components/products/ProductPrivacyLayout.jsx'
import { getApplicationBySlug } from '../../data/applications.js'

const product = getApplicationBySlug('checkvan-pro')

function CheckVanProPrivacyPage() {
  return <ProductPrivacyLayout product={product} />
}

export default CheckVanProPrivacyPage
