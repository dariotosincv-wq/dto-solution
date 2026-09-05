import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import DriverWorkPage from './DriverWorkPage';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  host?.remove();
  root = undefined;
  host = undefined;
});

async function renderPage() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);

  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={['/turni-e-busta-paga']}>
        <Routes>
          <Route path="/turni-e-busta-paga" element={<DriverWorkPage />} />
          <Route path="/turni-driver" element={<p>Pagina Turni esistente</p>} />
          <Route path="/driver-payroll" element={<p>Pagina Busta Paga esistente</p>} />
        </Routes>
      </MemoryRouter>
    );
  });
}

describe('Turni e Busta Paga', () => {
  it('apre la route Turni Driver esistente', async () => {
    await renderPage();
    const button = Array.from(host?.querySelectorAll('button') || [])
      .find((item) => item.textContent?.includes('Turni Driver'));

    await act(async () => button?.click());
    expect(host?.textContent).toContain('Pagina Turni esistente');
  });

  it('apre la route Busta Paga Driver esistente', async () => {
    await renderPage();
    const button = Array.from(host?.querySelectorAll('button') || [])
      .find((item) => item.textContent?.includes('Busta Paga Driver'));

    await act(async () => button?.click());
    expect(host?.textContent).toContain('Pagina Busta Paga esistente');
  });
});
