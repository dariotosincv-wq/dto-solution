import { handleDeviceOperationalDeparture } from './_lib/deviceOperationalDeparture.js'

export { handleDeviceOperationalDeparture }
export default function handler(request, response) {
  return handleDeviceOperationalDeparture(request, response)
}
