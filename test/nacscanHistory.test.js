import assert from 'node:assert/strict'
import test from 'node:test'
import { createDocumentSnapshot, createNacScanHistory, recordNacScanHistory, redoNacScanHistory, undoNacScanHistory } from '../src/lib/nacscanHistory.js'

const document = (id, annotations = []) => ({ pages: [{ id, kind: 'pdf', bytes: new Uint8Array([1, 2, 3]), annotations }], selectedId: id })

test('history snapshots preserve editable state without copying PDF bytes', () => {
  const source = document('one', [{ id: 'text', type: 'text', text: 'Prima' }])
  const snapshot = createDocumentSnapshot(source.pages, source.selectedId)
  source.pages[0].annotations[0].text = 'Dopo'
  assert.equal(snapshot.pages[0].annotations[0].text, 'Prima')
  assert.equal(snapshot.pages[0].bytes, source.pages[0].bytes)
})

test('undo and redo restore pages and annotations in order', () => {
  const first = document('one')
  const second = document('two', [{ id: 'cover', type: 'cover' }])
  let history = recordNacScanHistory(createNacScanHistory(), createDocumentSnapshot(first.pages, first.selectedId))
  const undone = undoNacScanHistory(history, createDocumentSnapshot(second.pages, second.selectedId))
  assert.equal(undone.snapshot.selectedId, 'one')
  assert.equal(undone.snapshot.pages[0].id, 'one')
  const redone = redoNacScanHistory(undone.history, undone.snapshot)
  assert.equal(redone.snapshot.selectedId, 'two')
  assert.equal(redone.snapshot.pages[0].annotations[0].type, 'cover')
})

test('history retains at most thirty operations and clears redo after an edit', () => {
  let history = createNacScanHistory()
  for (let index = 0; index < 35; index += 1) history = recordNacScanHistory(history, createDocumentSnapshot(document(String(index)).pages, String(index)))
  assert.equal(history.past.length, 30)
  history = { ...history, future: [createDocumentSnapshot(document('redo').pages, 'redo')] }
  history = recordNacScanHistory(history, createDocumentSnapshot(document('new').pages, 'new'))
  assert.equal(history.future.length, 0)
})
