import { useNavigate as useWebNavigate } from 'react-router-dom'
export * from 'react-router-dom'

export const driverRoute = (to: string) => ({
  '/': '/area-driver',
  '/turni-e-busta-paga': '/area-driver',
  '/turni-driver': '/area-driver/turni',
  '/driver-payroll': '/area-driver/busta-paga',
}[to] ?? to)

export function useNavigate() {
  const navigate = useWebNavigate()
  return (to: string | number, options?: object) => typeof to === 'number'
    ? navigate(to)
    : navigate(driverRoute(to), options)
}
