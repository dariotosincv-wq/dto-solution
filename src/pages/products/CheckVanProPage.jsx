import AndroidProductPage from '../../components/products/AndroidProductPage.jsx'
import { getApplicationBySlug } from '../../data/applications.js'

const product = getApplicationBySlug('checkvan-pro')

function CheckVanProPage() {
  return <AndroidProductPage product={product} />
}

export default CheckVanProPage
