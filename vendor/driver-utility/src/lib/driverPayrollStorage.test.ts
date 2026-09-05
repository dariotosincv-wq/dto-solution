import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Preferences } from '@capacitor/preferences';
import {
  DRIVER_PAYROLL_RESET_KEYS,
  resetDriverPayrollStorage,
} from './driverPayrollStorage';

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('driverPayrollStorage reset', () => {
  beforeEach(() => {
    vi.mocked(Preferences.remove).mockReset();
    vi.mocked(Preferences.remove).mockResolvedValue(undefined);
    window.localStorage.clear();
  });

  it('elimina solo i dati locali del Driver Payroll e preserva QR, turni e impostazioni', async () => {
    const deleteDatabase = vi.fn();
    const databases = vi.fn().mockResolvedValue([
      { name: 'driverPayroll.parserCache' },
      { name: 'driverPayroll.pdfFingerprints' },
      { name: 'qrLocali.cache' },
    ]);

    vi.stubGlobal('indexedDB', {
      databases,
      deleteDatabase: (name: string) => {
        deleteDatabase(name);
        const request: { onsuccess?: () => void; onerror?: () => void; onblocked?: () => void } = {};
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
    });

    window.localStorage.setItem('driverPayroll.payslips', '[{"id":"storico"}]');
    window.localStorage.setItem('driverPayroll.predictions', '[{"id":"simulazione"}]');
    window.localStorage.setItem('driverPayroll.comparisons', '[{"id":"confronto"}]');
    window.localStorage.setItem('driverPayroll.analysis', '{"totale":1}');
    window.localStorage.setItem('driverPayroll.assistant', '{"lastQuestion":"netto"}');
    window.localStorage.setItem('driverPayroll.pdfFingerprints', '["hash"]');
    window.localStorage.setItem('driverPayroll.parserCache', '{"layout":"v1"}');
    window.localStorage.setItem('driverPayroll.tempImports', '["tmp"]');
    window.localStorage.setItem('qrLocali.items', '[{"id":"qr"}]');
    window.localStorage.setItem('attendance', '{"2026-02-02":{"status":"Lavorato"}}');
    window.localStorage.setItem('defaultDriver', 'AM');

    await resetDriverPayrollStorage();

    expect(window.localStorage.getItem('driverPayroll.payslips')).toBeNull();
    expect(window.localStorage.getItem('driverPayroll.predictions')).toBeNull();
    expect(window.localStorage.getItem('driverPayroll.comparisons')).toBeNull();
    expect(window.localStorage.getItem('driverPayroll.analysis')).toBeNull();
    expect(window.localStorage.getItem('driverPayroll.assistant')).toBeNull();
    expect(window.localStorage.getItem('driverPayroll.pdfFingerprints')).toBeNull();
    expect(window.localStorage.getItem('driverPayroll.parserCache')).toBeNull();
    expect(window.localStorage.getItem('driverPayroll.tempImports')).toBeNull();
    expect(window.localStorage.getItem('qrLocali.items')).toBe('[{"id":"qr"}]');
    expect(window.localStorage.getItem('attendance')).toBe('{"2026-02-02":{"status":"Lavorato"}}');
    expect(window.localStorage.getItem('defaultDriver')).toBe('AM');

    expect(Preferences.remove).toHaveBeenCalledTimes(DRIVER_PAYROLL_RESET_KEYS.length);
    expect(Preferences.remove).toHaveBeenCalledWith({ key: 'driverPayroll.payslips' });
    expect(Preferences.remove).toHaveBeenCalledWith({ key: 'driverPayroll.predictions' });
    expect(Preferences.remove).toHaveBeenCalledWith({ key: 'driverPayroll.comparisons' });
    expect(Preferences.remove).toHaveBeenCalledWith({ key: 'driverPayroll.learningProfile' });
    expect(databases).toHaveBeenCalledOnce();
    expect(deleteDatabase).toHaveBeenCalledWith('driverPayroll.parserCache');
    expect(deleteDatabase).toHaveBeenCalledWith('driverPayroll.pdfFingerprints');
    expect(deleteDatabase).not.toHaveBeenCalledWith('qrLocali.cache');
  });
});
