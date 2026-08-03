import ProductPrivacyLayout from '../../components/products/ProductPrivacyLayout.jsx'
import { getApplicationBySlug } from '../../data/applications.js'

const product = getApplicationBySlug('driver-utility')

function DriverUtilityPrivacyPage() {
  return <ProductPrivacyLayout product={product} />
}

export default DriverUtilityPrivacyPage
