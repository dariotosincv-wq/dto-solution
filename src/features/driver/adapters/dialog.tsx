import { Portal as OriginalPortal } from '@radix-ui/react-alert-dialog'
import type { ComponentProps } from 'react'
export * from '@radix-ui/react-alert-dialog'

// Keep Radix dialogs inside the scoped DTO driver styles.
export function Portal(props: ComponentProps<typeof OriginalPortal>) {
  return <OriginalPortal {...props} container={document.getElementById('driver-portals') ?? undefined} />
}
