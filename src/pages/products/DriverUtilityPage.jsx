import AndroidProductPage from '../../components/products/AndroidProductPage.jsx'
import { getApplicationBySlug } from '../../data/applications.js'

const product = getApplicationBySlug('driver-utility')

function DriverUtilityPage() {
  return <AndroidProductPage product={product} />
}

export default DriverUtilityPage
