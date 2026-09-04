import { handleDeviceVehicleDamages } from './_lib/deviceVehicleDamages.js'

export { handleDeviceVehicleDamages }
export default function handler(request,response){return handleDeviceVehicleDamages(request,response)}
