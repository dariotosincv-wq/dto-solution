import { Preferences } from '@capacitor/preferences';
import type {
  ContractSource,
  DriverPayrollStorageKey,
  DriverProfile,
  LearningProfile,
  PayrollCode,
  PayrollComparison,
  PayrollPrediction,
  PayrollRule,
  PayslipImport,
} from './driverPayrollTypes';

export const DRIVER_PAYROLL_KEYS = {
  profiles: 'driverPayroll.profiles',
  contractSources: 'driverPayroll.contractSources',
  rules: 'driverPayroll.rules',
  codes: 'driverPayroll.codes',
  payslips: 'driverPayroll.payslips',
  predictions: 'driverPayroll.predictions',
  comparisons: 'driverPayroll.comparisons',
  learningProfile: 'driverPayroll.learningProfile',
} as const satisfies Record<string, DriverPayrollStorageKey>;

export const DRIVER_PAYROLL_RESET_PREFIX = 'driverPayroll.';

export const DRIVER_PAYROLL_RESET_KEYS = [
  ...Object.values(DRIVER_PAYROLL_KEYS),
  'driverPayroll.analysis',
  'driverPayroll.assistant',
  'driverPayroll.cache',
  'driverPayroll.comparisonBase',
  'driverPayroll.fingerprints',
  'driverPayroll.parserCache',
  'driverPayroll.pdfFingerprints',
  'driverPayroll.simulations',
  'driverPayroll.temporary',
  'driverPayroll.tempImports',
] as const;

type DriverPayrollCollectionMap = {
  [DRIVER_PAYROLL_KEYS.profiles]: DriverProfile[];
  [DRIVER_PAYROLL_KEYS.contractSources]: ContractSource[];
  [DRIVER_PAYROLL_KEYS.rules]: PayrollRule[];
  [DRIVER_PAYROLL_KEYS.codes]: PayrollCode[];
  [DRIVER_PAYROLL_KEYS.payslips]: PayslipImport[];
  [DRIVER_PAYROLL_KEYS.predictions]: PayrollPrediction[];
  [DRIVER_PAYROLL_KEYS.comparisons]: PayrollComparison[];
  [DRIVER_PAYROLL_KEYS.learningProfile]: LearningProfile[];
};

function stripTemporaryPayslipData(payslip: PayslipImport): PayslipImport {
  const { rawTextTemporary, ...persistable } = payslip;
  return persistable;
}

function sanitizeForStorage<K extends DriverPayrollStorageKey>(
  key: K,
  value: DriverPayrollCollectionMap[K]
): DriverPayrollCollectionMap[K] {
  if (key !== DRIVER_PAYROLL_KEYS.payslips) return value;

  return (value as PayslipImport[]).map(stripTemporaryPayslipData) as DriverPayrollCollectionMap[K];
}

async function readRawValue(key: DriverPayrollStorageKey): Promise<string | null> {
  const { value } = await Preferences.get({ key });
  if (value !== null) return value;

  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

async function writeRawValue(key: DriverPayrollStorageKey, value: string): Promise<void> {
  await Preferences.set({ key, value });

  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  } catch (error) {
    console.error(`Errore localStorage "${key}"`, error);
  }
}

export async function getDriverPayrollCollection<K extends DriverPayrollStorageKey>(
  key: K,
  fallback: DriverPayrollCollectionMap[K] = [] as DriverPayrollCollectionMap[K]
): Promise<DriverPayrollCollectionMap[K]> {
  try {
    const raw = await readRawValue(key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    console.error(`Archivio Driver Payroll corrotto per chiave "${key}"`, error);
    return fallback;
  }
}

export async function saveDriverPayrollCollection<K extends DriverPayrollStorageKey>(
  key: K,
  value: DriverPayrollCollectionMap[K]
): Promise<void> {
  const persistable = sanitizeForStorage(key, value);
  await writeRawValue(key, JSON.stringify(persistable));
}

export async function upsertDriverPayrollItem<
  K extends DriverPayrollStorageKey,
  T extends DriverPayrollCollectionMap[K][number] & { id?: string; code?: string },
>(
  key: K,
  item: T
): Promise<DriverPayrollCollectionMap[K]> {
  const current = await getDriverPayrollCollection(key);
  const itemKey = item.id ?? item.code;

  if (!itemKey) {
    const next = [...current, item] as DriverPayrollCollectionMap[K];
    await saveDriverPayrollCollection(key, next);
    return next;
  }

  const index = current.findIndex((entry) => {
    const entryKey = (entry as { id?: string; code?: string }).id ?? (entry as { code?: string }).code;
    return entryKey === itemKey;
  });

  const next =
    index >= 0
      ? current.map((entry, entryIndex) => (entryIndex === index ? item : entry))
      : [...current, item];

  await saveDriverPayrollCollection(key, next as DriverPayrollCollectionMap[K]);
  return next as DriverPayrollCollectionMap[K];
}

export async function getDriverPayrollStore() {
  const [
    profiles,
    contractSources,
    rules,
    codes,
    payslips,
    predictions,
    comparisons,
    learningProfile,
  ] = await Promise.all([
    getDriverPayrollCollection(DRIVER_PAYROLL_KEYS.profiles),
    getDriverPayrollCollection(DRIVER_PAYROLL_KEYS.contractSources),
    getDriverPayrollCollection(DRIVER_PAYROLL_KEYS.rules),
    getDriverPayrollCollection(DRIVER_PAYROLL_KEYS.codes),
    getDriverPayrollCollection(DRIVER_PAYROLL_KEYS.payslips),
    getDriverPayrollCollection(DRIVER_PAYROLL_KEYS.predictions),
    getDriverPayrollCollection(DRIVER_PAYROLL_KEYS.comparisons),
    getDriverPayrollCollection(DRIVER_PAYROLL_KEYS.learningProfile),
  ]);

  return {
    profiles,
    contractSources,
    rules,
    codes,
    payslips,
    predictions,
    comparisons,
    learningProfile,
  };
}

const removeLocalStoragePayrollData = () => {
  if (typeof window === 'undefined') return;

  try {
    const keys = new Set<string>(DRIVER_PAYROLL_RESET_KEYS);
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(DRIVER_PAYROLL_RESET_PREFIX)) {
        keys.add(key);
      }
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch (error) {
    console.error('Errore reset localStorage Driver Payroll', error);
  }
};

const removeIndexedDbPayrollData = async () => {
  if (typeof indexedDB === 'undefined') return;

  const payrollIndexedDb = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };

  const deleteDatabase = (name: string) =>
    new Promise<void>((resolve) => {
      const request = payrollIndexedDb.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });

  const databases = typeof payrollIndexedDb.databases === 'function' ? await payrollIndexedDb.databases() : [];
  const names = databases
    .map((database) => database.name)
    .filter((name): name is string => Boolean(name?.startsWith(DRIVER_PAYROLL_RESET_PREFIX)));

  await Promise.all(names.map(deleteDatabase));
};

export async function resetDriverPayrollStorage(): Promise<void> {
  await Promise.all(DRIVER_PAYROLL_RESET_KEYS.map((key) => Preferences.remove({ key })));
  removeLocalStoragePayrollData();
  await removeIndexedDbPayrollData();
}
