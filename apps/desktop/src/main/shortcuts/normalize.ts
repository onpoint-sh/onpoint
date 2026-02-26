import {
  acceleratorToSignature as toSignature,
  normalizeAccelerator as normalize
} from '@onpoint/shared/shortcut-accelerator'

export const normalizeAccelerator = normalize

export function acceleratorToSignature(accelerator: string): string | null {
  return toSignature(accelerator, process.platform)
}
