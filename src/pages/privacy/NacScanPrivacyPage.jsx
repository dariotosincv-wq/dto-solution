import ProductPrivacyLayout from '../../components/products/ProductPrivacyLayout.jsx'
import { getApplicationBySlug } from '../../data/applications.js'

const product = getApplicationBySlug('nacscan')

function NacScanPrivacyPage() {
  return <ProductPrivacyLayout product={product} />
}

export default NacScanPrivacyPage
