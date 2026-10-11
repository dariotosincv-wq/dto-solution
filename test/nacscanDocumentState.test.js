import assert from 'node:assert/strict'
import test from 'node:test'
import { hasNacScanUnsavedChanges, nacScanDocumentStateKey } from '../src/lib/nacscanDocumentState.js'

const page = (changes = {}) => ({ id: 'page-1', kind: 'pdf', name: 'documento.pdf', pageNumber: 1, rotation: 0, bytes: new Uint8Array([1, 2, 3]), annotations: [], ...changes })

test('document state ignores PDF bytes but tracks editable document changes', () => {
  const original = [page()]
  const saved = nacScanDocumentStateKey(original)
  assert.equal(hasNacScanUnsavedChanges([page({ bytes: new Uint8Array([9, 9, 9]) })], saved), false)
  assert.equal(hasNacScanUnsavedChanges([page({ rotation: 90 })], saved), true)
  assert.equal(hasNacScanUnsavedChanges([page({ annotations: [{ id: 'cover', type: 'cover', color: '#ffffff' }] })], saved), true)
})

test('empty workspace never displays an unsaved-work warning', () => {
  assert.equal(hasNacScanUnsavedChanges([], ''), false)
})
