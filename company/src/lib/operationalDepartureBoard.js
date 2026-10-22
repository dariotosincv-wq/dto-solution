const departureStates = {
  not_started: { label: 'Non avviata', color: '#475467', background: '#f2f4f7' },
  waiting: { label: 'In attesa', color: '#a15c00', background: '#fffaeb' },
  called: { label: 'Pronto', color: '#067647', background: '#ecfdf3' },
  departed: { label: 'Partito', color: '#175cd3', background: '#eff8ff' },
  timed_out: { label: 'Non partito / anomalia', color: '#b42318', background: '#fef3f2' },
  anomaly: { label: 'Non partito / anomalia', color: '#b42318', background: '#fef3f2' },
}

export function departurePresentation(state) {
  return departureStates[state] ?? departureStates.anomaly
}

export function connectionPresentation(connection) {
  if (connection?.state === 'connected') return { label: 'Collegato', color: '#067647', background: '#ecfdf3' }
  return { label: 'Non collegato', color: '#475467', background: '#f2f4f7' }
}

export function boardRows(board) {
  return Array.isArray(board?.items) ? board.items : []
}

export function formatOperationalTimestamp(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date)
}
