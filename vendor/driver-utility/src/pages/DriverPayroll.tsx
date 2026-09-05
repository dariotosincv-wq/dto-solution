import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toast } from 'sonner';
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Edit3,
  FileText,
  Loader2,
  Plus,
  ReceiptText,
  Save,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { PayrollValidationReport } from '@/components/payroll/PayrollValidationReport';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DRIVER_PAYROLL_IMPORT_PRIVACY_NOTE,
  importDriverPayrollPdfs,
  saveConfirmedImportedPayroll,
} from '@/lib/driverPayrollImportService';
import { payrollDebugLog } from '@/lib/driverPayrollDebugLogger';
import type { DriverPayrollImportResult } from '@/lib/driverPayrollImportTypes';
import {
  buildDriverPayrollReadDiagnosticFileName,
  buildDriverPayrollReadDiagnosticTxt,
} from '@/lib/driverPayrollReadDiagnosticTxt';
import {
  analyzeDriverPayrollHistory,
  type DriverPayrollAnalysisMetricKey,
} from '@/lib/driverPayrollAnalysis';
import { validatePayrollHistory } from '@/lib/driverPayrollHistoricalValidation';
import { getPayrollCategoryForCode } from '@/lib/driverPayrollPayslipNormalizer';
import {
  answerDriverPayrollQuestion,
  type DriverPayrollAssistantResponse,
} from '@/lib/driverPayrollAssistant';
import {
  compareDriverPayrollMonth,
  createDriverPayrollComparisonBaseFromLocalData,
  type DriverPayrollComparisonRow,
} from '@/lib/driverPayrollComparison';
import { explainDriverPayrollComparison } from '@/lib/driverPayrollRuleExplanationEngine';
import {
  createDriverPayrollSimulation,
  readDriverAttendanceFromLocalStorage,
  type DriverPayrollSimulatorManualLine,
  type DriverPayrollSimulatorManualLineKind,
} from '@/lib/driverPayrollSimulator';
import {
  DRIVER_PAYROLL_KEYS,
  getDriverPayrollCollection,
  resetDriverPayrollStorage,
  saveDriverPayrollCollection,
} from '@/lib/driverPayrollStorage';
import type { PayrollPrediction, PayslipImport, PayslipLine } from '@/lib/driverPayrollTypes';
import { AttendancePayrollVerificationReport } from '@/components/payroll/AttendancePayrollVerificationReport';
import {
  getPayslipLineEconomicAmount,
  getPayslipLineQuantity,
  getPayslipLineSemanticValues,
  matchesPayslipLineSemantic,
  normalizePayslipLineValues,
  type PayslipLineSemanticSelector,
} from '@/lib/driverPayrollLineValues';

const monthNames = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

const euroFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
});

type EditableNumberKey =
  | 'grossAmount'
  | 'netAmount'
  | 'totalDeductions'
  | 'workedDays'
  | 'ordinaryHours'
  | 'overtimeHours'
  | 'travelDays'
  | 'travelAmount'
  | 'sundayDays'
  | 'holidayDays'
  | 'vacation'
  | 'par'
  | 'exHoliday'
  | 'sickness'
  | 'injury'
  | 'pdr'
  | 'thirteenth'
  | 'fourteenth'
  | 'fringeBenefit'
  | 'bonus'
  | 'otherLines';

type EditablePayslip = {
  source: DriverPayrollImportResult;
  payslip: PayslipImport;
  modifiedFields: Set<string>;
};

type NumberFieldConfig = {
  key: EditableNumberKey;
  label: string;
  section: 'summary' | 'attendance' | 'extra';
  kind: 'summary' | 'lineQuantity' | 'lineAmount' | 'computed';
  summaryKey?: 'grossAmount' | 'netAmount' | 'totalDeductions';
  codes?: string[];
  selector?: PayslipLineSemanticSelector;
  allowNegative?: boolean;
};

const numberFields: NumberFieldConfig[] = [
  { key: 'grossAmount', label: 'Totale competenze', section: 'summary', kind: 'summary', summaryKey: 'grossAmount' },
  { key: 'netAmount', label: 'Netto', section: 'summary', kind: 'summary', summaryKey: 'netAmount' },
  {
    key: 'totalDeductions',
    label: 'Totale trattenute',
    section: 'summary',
    kind: 'summary',
    summaryKey: 'totalDeductions',
    allowNegative: true,
  },
  { key: 'workedDays', label: 'Giorni lavorati', section: 'attendance', kind: 'lineQuantity', codes: ['0170'], selector: { canonicalKeys: ['payroll.worked_days'], categories: ['worked_days'], legacyCodes: ['0170'] } },
  { key: 'ordinaryHours', label: 'Ore ordinarie', section: 'attendance', kind: 'lineAmount', codes: ['0169', '0785'], selector: { canonicalKeys: ['payroll.worked_hours', 'payroll.effective_hours'], categories: ['worked_hours', 'effective_hours'], legacyCodes: ['0169', '0785'] } },
  { key: 'overtimeHours', label: 'Ore straordinarie', section: 'attendance', kind: 'lineQuantity', codes: ['2030', '2014'], selector: { canonicalKeys: ['payroll.overtime', 'payroll.overtime.part_time_18'], categories: ['overtime'], legacyCodes: ['2030', '2014'] } },
  { key: 'travelDays', label: 'Trasferte', section: 'extra', kind: 'lineQuantity', codes: ['2310'], selector: { canonicalKeys: ['payroll.travel_allowance'], categories: ['travel_allowance'], legacyCodes: ['2310'] } },
  { key: 'travelAmount', label: 'Importo trasferte', section: 'extra', kind: 'lineAmount', codes: ['2310'], selector: { canonicalKeys: ['payroll.travel_allowance'], categories: ['travel_allowance'], legacyCodes: ['2310'] } },
  { key: 'sundayDays', label: 'Domeniche', section: 'attendance', kind: 'lineQuantity', codes: ['2315'], selector: { canonicalKeys: ['payroll.sunday_premium'], categories: ['sunday_premium'], legacyCodes: ['2315'] } },
  { key: 'holidayDays', label: 'Festivita', section: 'attendance', kind: 'lineQuantity', codes: ['3900', '3901'], selector: { canonicalKeys: ['payroll.holiday.paid', 'payroll.holiday.premium'], categories: ['paid_leave', 'holiday_premium'], legacyCodes: ['3900', '3901'] } },
  { key: 'vacation', label: 'Ferie', section: 'attendance', kind: 'lineQuantity', codes: ['5000'], selector: { canonicalKeys: ['payroll.vacation'], categories: ['vacation'], legacyCodes: ['5000'] } },
  { key: 'par', label: 'PAR', section: 'attendance', kind: 'lineQuantity', codes: ['5050'], selector: { canonicalKeys: ['payroll.permission'], categories: ['permission'], legacyCodes: ['5050'] } },
  { key: 'exHoliday', label: 'Ex festivita', section: 'attendance', kind: 'lineQuantity', codes: ['5100', '5121'], selector: { canonicalKeys: ['payroll.former_holiday_leave', 'payroll.former_holiday_paid'], categories: ['former_holiday_leave'], legacyCodes: ['5100', '5121'] } },
  { key: 'sickness', label: 'Malattia', section: 'attendance', kind: 'lineQuantity', codes: ['1981', '2500', '2520', '2530', '2600'], selector: { categories: ['sickness', 'sickness_waiting_period', 'sickness_employer_supplement'], legacyCodes: ['1981', '2500', '2520', '2530', '2600'] } },
  { key: 'injury', label: 'Infortunio', section: 'attendance', kind: 'lineQuantity', codes: ['1989', '2700', '2720', '2800'], selector: { categories: ['accident', 'accident_employer_supplement'], legacyCodes: ['1989', '2700', '2720', '2800'] } },
  { key: 'pdr', label: 'PDR', section: 'extra', kind: 'lineAmount', codes: ['4009'], selector: { canonicalKeys: ['payroll.performance_bonus'], categories: ['performance_bonus'], legacyCodes: ['4009'] } },
  { key: 'thirteenth', label: 'Tredicesima', section: 'extra', kind: 'lineAmount', codes: ['5340'], selector: { canonicalKeys: ['payroll.thirteenth_month'], categories: ['thirteenth_month'], legacyCodes: ['5340'] } },
  { key: 'fourteenth', label: 'Quattordicesima', section: 'extra', kind: 'lineAmount', codes: ['5390'], selector: { canonicalKeys: ['payroll.fourteenth_month'], categories: ['fourteenth_month'], legacyCodes: ['5390'] } },
  { key: 'fringeBenefit', label: 'Fringe benefit', section: 'extra', kind: 'lineAmount', codes: ['5963'], selector: { canonicalKeys: ['payroll.fringe_benefit'], categories: ['fringe_benefit'], legacyCodes: ['5963'] } },
  { key: 'bonus', label: 'Bonus', section: 'extra', kind: 'lineAmount', codes: ['4009'], selector: { categories: ['performance_bonus', 'production_bonus', 'generic_bonus'], legacyCodes: ['4009'] } },
  { key: 'otherLines', label: 'Altre voci', section: 'extra', kind: 'computed' },
];

const getPeriodLabel = (payslip?: PayslipImport) => {
  if (!payslip) return 'Documento non letto';
  if (!(payslip.month >= 1 && payslip.month <= 12) || !(payslip.year > 0)) return 'Periodo non riconosciuto';
  const month = payslip.month >= 1 && payslip.month <= 12 ? monthNames[payslip.month - 1] : 'Mese da verificare';
  return `${month} ${payslip.year || ''}`.trim();
};

const getNumericPeriodLabel = (payslip?: PayslipImport) => {
  if (!payslip || !(payslip.month >= 1 && payslip.month <= 12) || !(payslip.year > 0)) return 'Periodo non riconosciuto';
  return `${String(payslip.month).padStart(2, '0')} / ${payslip.year}`;
};

const formatCurrency = (value?: number) => (value === undefined ? '-' : euroFormatter.format(value));

const formatAnalysisCurrency = (value?: number) =>
  value === undefined ? 'Dato non disponibile' : euroFormatter.format(value);

const formatAnalysisNumber = (value?: number) =>
  value === undefined
    ? 'Dato non disponibile'
    : new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value);

const formatComparisonValue = (value?: number) =>
  value === undefined ? 'Dato non disponibile' : new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value);

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const normalizeNumberInput = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const roundPayrollNumber = (value: number | undefined) =>
  value === undefined ? undefined : Math.round((value + Number.EPSILON) * 100) / 100;

const sumLines = (lines: PayslipLine[], field: NumberFieldConfig, valueKey: 'quantity' | 'amount') => {
  const selector = field.selector ?? { legacyCodes: field.codes };
  const matching = lines.filter((line) => matchesPayslipLineSemantic(line, selector) && (line.confidence ?? 100) >= 70);
  if (matching.length === 0) return undefined;
  return roundPayrollNumber(matching.reduce(
    (total, line) =>
      total +
      (valueKey === 'quantity'
        ? getPayslipLineQuantity(line) ?? 0
        : getPayslipLineEconomicAmount(line) ?? 0),
    0
  ));
};

const getFieldValue = (payslip: PayslipImport, field: NumberFieldConfig): number | undefined => {
  if (field.kind === 'summary' && field.summaryKey) {
    const confidence = payslip.fieldConfidence?.[field.summaryKey]?.confidence;
    if (confidence === 'missing' || confidence === 'uncertain') return undefined;
    return payslip.summary[field.summaryKey];
  }
  if (field.key === 'ordinaryHours') {
    const line = payslip.parsedLines.find(
      (item) =>
        matchesPayslipLineSemantic(item, field.selector ?? { legacyCodes: field.codes }) &&
        (item.confidence ?? 100) >= 70
    );
    return roundPayrollNumber(line ? getPayslipLineSemanticValues(line).informationalValue : undefined);
  }
  if (field.key === 'sickness') {
    const hoursLine = payslip.parsedLines.find(
      (item) =>
        matchesPayslipLineSemantic(item, {
          canonicalKeys: ['payroll.sickness.hours'],
          legacyCodes: ['1981'],
        }) &&
        (item.confidence ?? 100) >= 70
    );
    return roundPayrollNumber(hoursLine ? getPayslipLineSemanticValues(hoursLine).informationalValue : undefined)
      ?? sumLines(payslip.parsedLines, field, 'quantity');
  }
  if (field.kind === 'lineQuantity' && field.codes) return sumLines(payslip.parsedLines, field, 'quantity');
  if (field.kind === 'lineAmount' && field.codes) return sumLines(payslip.parsedLines, field, 'amount');
  if (field.key === 'otherLines') {
    const knownCodes = new Set(numberFields.flatMap((item) => item.codes ?? []));
    const amount = payslip.parsedLines
      .filter((line) => line.code && !knownCodes.has(line.code) && getPayrollCategoryForCode(line.code) === undefined)
      .reduce((total, line) => total + (getPayslipLineEconomicAmount(line) ?? 0), 0);
    return amount ? roundPayrollNumber(amount) : undefined;
  }
  return undefined;
};

const ensureLineForField = (payslip: PayslipImport, field: NumberFieldConfig): { line: PayslipLine; lines: PayslipLine[] } => {
  const lines = [...payslip.parsedLines];
  const code = field.codes?.[0] ?? field.key;
  const existingIndex = lines.findIndex((line) => line.code === code);
  if (existingIndex >= 0) return { line: { ...lines[existingIndex] }, lines };

  const line: PayslipLine = {
    code,
    label: field.label,
    confidence: 100,
    type: field.allowNegative ? 'deduction' : 'earning',
  };
  lines.push(line);
  return { line, lines };
};

const applyNumberField = (payslip: PayslipImport, field: NumberFieldConfig, value: number | undefined): PayslipImport => {
  if (field.kind === 'summary' && field.summaryKey) {
    return {
      ...payslip,
      summary: {
        ...payslip.summary,
        [field.summaryKey]: value,
      },
    };
  }

  if ((field.kind === 'lineQuantity' || field.kind === 'lineAmount') && field.codes) {
    const { line, lines } = ensureLineForField(payslip, field);
    const nextLine = normalizePayslipLineValues(
      field.kind === 'lineQuantity'
        ? { ...line, quantity: value, confidence: 100 }
        : line.type === 'informational'
        ? { ...line, informationalValue: value, amount: undefined, confidence: 100 }
        : line.type === 'deduction'
        ? { ...line, amount: value, deductionAmount: value === undefined ? undefined : Math.abs(value), confidence: 100 }
        : { ...line, amount: value, earningAmount: value, confidence: 100 }
    );
    const index = lines.findIndex((item) => item.code === nextLine.code);
    lines[index] = nextLine;
    return { ...payslip, parsedLines: lines };
  }

  return payslip;
};

const removeTemporaryData = (payslip: PayslipImport): PayslipImport => {
  const { rawTextTemporary, ...safePayslip } = payslip;
  return {
    ...safePayslip,
    parsedLines: safePayslip.parsedLines.map(({ rawLine, ...line }) => line),
  };
};

const isDuplicateWarning = (result: DriverPayrollImportResult) =>
  result.warnings.some((warning) => warning.code === 'POSSIBLE_DUPLICATE');

const canSavePayslip = (payslip: PayslipImport) => {
  const hasPeriod = payslip.month >= 1 && payslip.month <= 12 && payslip.year > 2000;
  const hasEconomicValue = payslip.summary.netAmount !== undefined || payslip.summary.grossAmount !== undefined;
  return hasPeriod && hasEconomicValue;
};

const getDetectedFormatLabel = (payslip: PayslipImport) => {
  if (payslip.detectedFormat === 'logisticsLayoutV1') return 'Layout Logistica 1';
  if (payslip.detectedFormat === 'generic') return 'Generico';
  return 'Non riconosciuto';
};

const getUncertainFields = (payslip: PayslipImport) =>
  Object.entries(payslip.fieldConfidence ?? {}).filter(([, info]) => info.confidence === 'uncertain');

const DriverPayroll = () => {
  const now = new Date();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState('import');
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<DriverPayrollImportResult[]>([]);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [editable, setEditable] = useState<Record<string, EditablePayslip>>({});
  const [history, setHistory] = useState<PayslipImport[]>([]);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [openedHistoryId, setOpenedHistoryId] = useState<string | null>(null);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [historyDraft, setHistoryDraft] = useState<PayslipImport | null>(null);
  const [predictions, setPredictions] = useState<PayrollPrediction[]>([]);
  const [selectedComparisonPeriod, setSelectedComparisonPeriod] = useState<string>('');
  const [simulatorMonth, setSimulatorMonth] = useState(now.getMonth());
  const [simulatorYear, setSimulatorYear] = useState(now.getFullYear());
  const [simulatorManualLines, setSimulatorManualLines] = useState<DriverPayrollSimulatorManualLine[]>([]);
  const [authorizedOvertime30Hours, setAuthorizedOvertime30Hours] = useState('');
  const [authorizedOvertime50Hours, setAuthorizedOvertime50Hours] = useState('');
  const [overtime30HourlyAmount, setOvertime30HourlyAmount] = useState('');
  const [overtime50HourlyAmount, setOvertime50HourlyAmount] = useState('');
  const [assistantMonth, setAssistantMonth] = useState(now.getMonth() + 1);
  const [assistantYear, setAssistantYear] = useState(now.getFullYear());
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantResponse, setAssistantResponse] = useState<DriverPayrollAssistantResponse | null>(null);
  const [isResettingPayroll, setIsResettingPayroll] = useState(false);

  const selectedResult = results.find((result) => result.importId === selectedImportId) ?? results[0];
  const selectedEditable = selectedResult ? editable[selectedResult.importId] : undefined;
  const historyAnalysis = useMemo(() => analyzeDriverPayrollHistory(history), [history]);
  const historicalValidation = useMemo(() => validatePayrollHistory(history), [history]);
  const comparisonBase = useMemo(
    () => createDriverPayrollComparisonBaseFromLocalData(history, predictions),
    [history, predictions]
  );
  const selectedComparisonSource = useMemo(() => {
    if (comparisonBase.length === 0) return undefined;
    return (
      comparisonBase.find((entry) => `${entry.year}-${entry.month}` === selectedComparisonPeriod) ??
      comparisonBase[comparisonBase.length - 1]
    );
  }, [comparisonBase, selectedComparisonPeriod]);
  const selectedComparison = useMemo(
    () => (selectedComparisonSource ? compareDriverPayrollMonth(selectedComparisonSource) : undefined),
    [selectedComparisonSource]
  );
  const selectedComparisonExplanations = useMemo(
    () => (selectedComparison ? explainDriverPayrollComparison(selectedComparison) : []),
    [selectedComparison]
  );
  const simulatorAttendance = useMemo(() => readDriverAttendanceFromLocalStorage(), [simulatorMonth, simulatorYear, activeTab]);
  const simulator = useMemo(
    () =>
      createDriverPayrollSimulation({
        year: simulatorYear,
        month: simulatorMonth,
        attendance: simulatorAttendance,
        manualLines: simulatorManualLines,
        authorizedOvertime30Hours: normalizeNumberInput(authorizedOvertime30Hours),
        authorizedOvertime50Hours: normalizeNumberInput(authorizedOvertime50Hours),
        overtime30HourlyAmount: normalizeNumberInput(overtime30HourlyAmount),
        overtime50HourlyAmount: normalizeNumberInput(overtime50HourlyAmount),
      }),
    [
      authorizedOvertime30Hours,
      authorizedOvertime50Hours,
      overtime30HourlyAmount,
      overtime50HourlyAmount,
      simulatorAttendance,
      simulatorManualLines,
      simulatorMonth,
      simulatorYear,
    ]
  );
  const assistantComparisonSource = useMemo(
    () => comparisonBase.find((entry) => entry.year === assistantYear && entry.month === assistantMonth),
    [assistantMonth, assistantYear, comparisonBase]
  );
  const assistantComparison = useMemo(
    () => (assistantComparisonSource ? compareDriverPayrollMonth(assistantComparisonSource) : undefined),
    [assistantComparisonSource]
  );
  const assistantRuleExplanations = useMemo(
    () => (assistantComparison ? explainDriverPayrollComparison(assistantComparison) : []),
    [assistantComparison]
  );
  const assistantSimulation = useMemo(
    () =>
      createDriverPayrollSimulation({
        year: assistantYear,
        month: assistantMonth - 1,
        attendance: readDriverAttendanceFromLocalStorage(),
      }),
    [assistantMonth, assistantYear, activeTab]
  );

  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      const aHasPeriod = a.year > 0 && a.month >= 1 && a.month <= 12;
      const bHasPeriod = b.year > 0 && b.month >= 1 && b.month <= 12;
      if (aHasPeriod !== bHasPeriod) return aHasPeriod ? -1 : 1;
      if (a.year !== b.year) return b.year - a.year;
      if (a.month !== b.month) return b.month - a.month;
      return new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime();
    });
  }, [history]);

  const loadHistory = async () => {
    const saved = await getDriverPayrollCollection(DRIVER_PAYROLL_KEYS.payslips);
    setHistory(saved);
  };

  const loadPredictions = async () => {
    const saved = await getDriverPayrollCollection(DRIVER_PAYROLL_KEYS.predictions);
    setPredictions(saved);
  };

  useEffect(() => {
    void loadHistory();
    void loadPredictions();
  }, []);

  useEffect(() => {
    if (selectedComparisonPeriod || comparisonBase.length === 0) return;
    const latest = comparisonBase[comparisonBase.length - 1];
    setSelectedComparisonPeriod(`${latest.year}-${latest.month}`);
  }, [comparisonBase, selectedComparisonPeriod]);

  const handleSelectFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setIsImporting(true);
    setResults([]);
    setSelectedImportId(null);
    setEditable({});

    try {
      const imported = await importDriverPayrollPdfs(files);
      const nextEditable = imported.reduce<Record<string, EditablePayslip>>((acc, result) => {
        if (result.payslip) {
          acc[result.importId] = {
            source: result,
            payslip: removeTemporaryData(result.payslip),
            modifiedFields: new Set(),
          };
        }
        return acc;
      }, {});
      payrollDebugLog("[PAYROLL][7] Importazioni inviate all'anteprima:", {
        importIds: Object.keys(nextEditable),
        count: Object.keys(nextEditable).length,
      });

      setResults(imported);
      setEditable(nextEditable);
      setSelectedImportId(imported.find((result) => result.payslip)?.importId ?? imported[0]?.importId ?? null);
    } catch {
      toast.error('Importazione non riuscita');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateEditableField = (importId: string, field: NumberFieldConfig, rawValue: string) => {
    const value = normalizeNumberInput(rawValue);
    setEditable((prev) => {
      const current = prev[importId];
      if (!current) return prev;
      const modifiedFields = new Set(current.modifiedFields);
      modifiedFields.add(field.key);
      return {
        ...prev,
        [importId]: {
          ...current,
          payslip: applyNumberField(current.payslip, field, value),
          modifiedFields,
        },
      };
    });
  };

  const updatePeriod = (importId: string, field: 'month' | 'year', rawValue: string) => {
    const value = normalizeNumberInput(rawValue);
    setEditable((prev) => {
      const current = prev[importId];
      if (!current) return prev;
      const modifiedFields = new Set(current.modifiedFields);
      modifiedFields.add(field);
      return {
        ...prev,
        [importId]: {
          ...current,
          payslip: {
            ...current.payslip,
            [field]: value ?? 0,
          },
          modifiedFields,
        },
      };
    });
  };

  const saveOne = async (importId: string) => {
    const item = editable[importId];
    if (!item) return;
    if (!canSavePayslip(item.payslip)) {
      toast.error('Inserisci mese, anno e almeno netto o totale competenze prima di salvare');
      return;
    }
    if (isDuplicateWarning(item.source) && !window.confirm('Questa busta paga potrebbe essere gia presente. Vuoi salvarla comunque?')) {
      return;
    }

    await saveConfirmedImportedPayroll({
      ...item.source,
      payslip: removeTemporaryData(item.payslip),
    });
    toast.success('Busta paga salvata nello storico locale');
    await loadHistory();
    setActiveTab('history');
  };

  const saveAllValid = async () => {
    const validItems = Object.values(editable).filter((item) => canSavePayslip(item.payslip));
    if (validItems.length === 0) {
      toast.error('Nessuna busta valida da salvare');
      return;
    }

    const hasDuplicate = validItems.some((item) => isDuplicateWarning(item.source));
    if (hasDuplicate && !window.confirm('Una o piu buste potrebbero essere gia presenti. Vuoi salvarle comunque?')) {
      return;
    }

    for (const item of validItems) {
      await saveConfirmedImportedPayroll({
        ...item.source,
        payslip: removeTemporaryData(item.payslip),
      });
    }

    toast.success('Buste paga salvate nello storico locale');
    await loadHistory();
    setActiveTab('history');
  };

  const exportReadDiagnostic = async (result: DriverPayrollImportResult) => {
    if (!result.temporaryReadDiagnostic) {
      toast.error('Diagnostica di lettura non disponibile per questa importazione');
      return;
    }

    const report = buildDriverPayrollReadDiagnosticTxt(result, historicalValidation);
    const fileName = buildDriverPayrollReadDiagnosticFileName(result);

    try {
      if (Capacitor.isNativePlatform()) {
        const path = `driverPayrollDiagnostics/${fileName}`;
        await Filesystem.writeFile({
          path,
          data: report,
          directory: Directory.Cache,
          encoding: 'utf8',
          recursive: true,
        });
        const uri = await Filesystem.getUri({ path, directory: Directory.Cache });
        try {
          await Share.share({
            title: 'Diagnostica lettura Busta Paga',
            text: 'Report diagnostico temporaneo e locale della lettura PDF.',
            url: uri.uri,
            dialogTitle: 'Condividi diagnostica lettura',
          });
        } finally {
          await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {});
        }
        toast.success('Diagnostica pronta per la condivisione locale');
        return;
      }

      const file = new File([report], fileName, { type: 'text/plain;charset=utf-8' });
      const objectUrl = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success('Diagnostica scaricata in locale');
    } catch (error) {
      console.error('Esportazione diagnostica Payroll non riuscita', error);
      toast.error('Non è stato possibile esportare la diagnostica');
    }
  };

  const deleteHistoryItem = async (payslip: PayslipImport) => {
    if (!window.confirm('Eliminare questa busta paga dallo storico locale?\n\nQuesta operazione non puo essere annullata.')) {
      return;
    }
    const next = history.filter((item) => item.id !== payslip.id);
    await saveDriverPayrollCollection(DRIVER_PAYROLL_KEYS.payslips, next);
    setHistory(next);
    setOpenedHistoryId(null);
    toast.success('Busta paga eliminata dallo storico locale');
  };

  const startEditHistory = (payslip: PayslipImport) => {
    setEditingHistoryId(payslip.id);
    setHistoryDraft(removeTemporaryData(payslip));
    setOpenedHistoryId(payslip.id);
  };

  const saveHistoryDraft = async () => {
    if (!historyDraft) return;
    if (!canSavePayslip(historyDraft)) {
      toast.error('Inserisci mese, anno e almeno netto o totale competenze prima di salvare');
      return;
    }
    const next = history.map((item) => (item.id === historyDraft.id ? removeTemporaryData(historyDraft) : item));
    await saveDriverPayrollCollection(DRIVER_PAYROLL_KEYS.payslips, next);
    setHistory(next);
    setEditingHistoryId(null);
    setHistoryDraft(null);
    toast.success('Correzioni salvate nello storico locale');
  };

  const updateManualLine = (id: string, patch: Partial<DriverPayrollSimulatorManualLine>) => {
    setSimulatorManualLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        return {
          ...next,
          type: next.kind === 'damage_deduction' || next.kind === 'advance_recovery' || next.kind === 'manual_deduction' || next.kind === 'other_negative'
            ? 'deduction'
            : 'earning',
        };
      })
    );
  };

  const addManualLine = () => {
    setSimulatorManualLines((current) => [
      ...current,
      {
        id: `manual_${Date.now()}_${current.length}`,
        kind: 'manual_bonus',
        description: '',
        amount: 0,
        type: 'earning',
      },
    ]);
  };

  const saveSimulatorPrediction = async () => {
    const prediction = simulator.prediction;
    const existing = predictions.find((item) => item.year === prediction.year && item.month === prediction.month);
    const next = existing
      ? predictions.map((item) => (item.year === prediction.year && item.month === prediction.month ? prediction : item))
      : [...predictions, prediction];

    await saveDriverPayrollCollection(DRIVER_PAYROLL_KEYS.predictions, next);
    setPredictions(next);
    setSelectedComparisonPeriod(`${prediction.year}-${prediction.month}`);
    toast.success(existing ? 'Riepilogo mese aggiornato localmente' : 'Riepilogo mese salvato localmente');
  };

  const resetPayrollUiState = () => {
    setResults([]);
    setSelectedImportId(null);
    setEditable({});
    setHistory([]);
    setOpenedHistoryId(null);
    setEditingHistoryId(null);
    setHistoryDraft(null);
    setPredictions([]);
    setSelectedComparisonPeriod('');
    setSimulatorManualLines([]);
    setAuthorizedOvertime30Hours('');
    setAuthorizedOvertime50Hours('');
    setOvertime30HourlyAmount('');
    setOvertime50HourlyAmount('');
    setAssistantQuestion('');
    setAssistantResponse(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResetPayroll = async () => {
    setIsResettingPayroll(true);
    try {
      await resetDriverPayrollStorage();
      resetPayrollUiState();
      toast.success('Driver Payroll azzerato correttamente.');
    } catch {
      toast.error('Reset Driver Payroll non riuscito');
    } finally {
      setIsResettingPayroll(false);
    }
  };

  const renderNumberInput = (
    payslip: PayslipImport,
    field: NumberFieldConfig,
    onChange: (field: NumberFieldConfig, value: string) => void,
    modified = false
  ) => {
    const value = getFieldValue(payslip, field);
    const confidence = field.summaryKey ? payslip.fieldConfidence?.[field.summaryKey]?.confidence : undefined;
    const isRecognized = value !== undefined && confidence !== 'missing' && confidence !== 'uncertain';
    const id = `${payslip.id}-${field.key}`;
    return (
      <div key={field.key} className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={id} className="text-xs text-slate-600">
            {field.label}
          </Label>
          <span className={`text-[10px] font-semibold ${modified ? 'text-amber-700' : isRecognized ? 'text-emerald-700' : 'text-slate-500'}`}>
            {modified ? 'Modificato' : isRecognized ? 'Riconosciuto' : 'Non riconosciuto'}
          </span>
        </div>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step="0.01"
          value={value ?? ''}
          onChange={(event) => onChange(field, event.target.value)}
          className="h-11 text-base"
        />
        {field.key === 'netAmount' && !isRecognized && (
          <p className="text-xs font-semibold text-amber-700">Netto non riconosciuto - verifica manualmente</p>
        )}
      </div>
    );
  };

  const renderPreview = (editableItem: EditablePayslip) => {
    const { payslip, source, modifiedFields } = editableItem;
    const fieldsBySection = (section: NumberFieldConfig['section']) =>
      numberFields.filter((field) => {
        if (field.section !== section) return false;
        if (field.section === 'summary') return true;
        return getFieldValue(payslip, field) !== undefined || modifiedFields.has(field.key);
      });
    const uncertainFields = getUncertainFields(payslip);

    return (
      <div className="space-y-4" data-testid="payroll-preview">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Anteprima</p>
              <h2 className="text-xl font-extrabold text-slate-900">{getPeriodLabel(payslip)}</h2>
              <p className="text-sm font-semibold text-slate-700">Formato rilevato: {getDetectedFormatLabel(payslip)}</p>
              <p className="text-sm text-slate-600">Affidabilita lettura: {source.confidence ?? payslip.confidence ?? '-'}%</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              Solo locale
            </span>
          </div>

          {source.warnings.length > 0 && (
            <div className="mt-3 space-y-2">
              {source.warnings.map((warning) => (
                <div key={`${source.importId}-${warning.code}-${warning.field ?? ''}`} className="flex gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{warning.message}</span>
                </div>
              ))}
            </div>
          )}
          {payslip.detectedFormat !== 'logisticsLayoutV1' && (
            <div className="mt-3 rounded-lg bg-blue-50 p-2 text-sm text-blue-900">
              La busta paga e stata letta solo parzialmente. Controlla e correggi i dati prima di salvarla.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-700">Periodo</h3>
          <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-extrabold text-slate-800">
            {getNumericPeriodLabel(payslip)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`month-${source.importId}`} className="text-xs text-slate-600">
                Mese
              </Label>
              <Input
                id={`month-${source.importId}`}
                type="number"
                min={1}
                max={12}
                value={payslip.month || ''}
                onChange={(event) => updatePeriod(source.importId, 'month', event.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`year-${source.importId}`} className="text-xs text-slate-600">
                Anno
              </Label>
              <Input
                id={`year-${source.importId}`}
                type="number"
                value={payslip.year || ''}
                onChange={(event) => updatePeriod(source.importId, 'year', event.target.value)}
                className="h-11"
              />
            </div>
          </div>
        </div>

        {(['summary', 'attendance', 'extra'] as const).map((section) => (
          <div key={section} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-700">
              {section === 'summary' ? 'Riepilogo economico' : section === 'attendance' ? 'Presenze e giornate' : 'Voci aggiuntive'}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fieldsBySection(section).length > 0 ? (
                fieldsBySection(section).map((field) =>
                  renderNumberInput(
                    payslip,
                    field,
                    (nextField, value) => updateEditableField(source.importId, nextField, value),
                    modifiedFields.has(field.key)
                  )
                )
              ) : (
                <p className="text-sm text-slate-500">Nessuna voce riconosciuta in questa sezione.</p>
              )}
            </div>
          </div>
        ))}

        <AttendancePayrollVerificationReport payslip={payslip} />

        <PayrollValidationReport validationPipeline={source.validationPipeline} />

        {uncertainFields.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
            <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide">Campi da verificare</h3>
            <div className="space-y-2 text-sm">
              {uncertainFields.map(([field, info]) => (
                <p key={field}>
                  <span className="font-bold">{field}</span>: {info.value ?? 'Non riconosciuto'} da {info.sourceLabel ?? 'lettura PDF'}
                </p>
              ))}
            </div>
          </div>
        )}

        {source.payrollValidation && (
          <div
            className={`rounded-xl border p-4 text-sm shadow-sm ${
              source.payrollValidation.overallStatus === 'valid'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : source.payrollValidation.overallStatus === 'inconsistent'
                  ? 'border-amber-300 bg-amber-50 text-amber-950'
                  : 'border-slate-200 bg-slate-50 text-slate-800'
            }`}
          >
            <p className="font-extrabold">
              {source.payrollValidation.overallStatus === 'valid'
                ? 'Controlli matematici superati'
                : source.payrollValidation.overallStatus === 'valid_with_warnings'
                  ? 'Controlli completati con avvisi'
                  : source.payrollValidation.overallStatus === 'inconsistent'
                    ? 'È stata rilevata una differenza da verificare'
                    : 'Dati insufficienti per una verifica completa'}
            </p>
            <p className="mt-1">
              {source.payrollValidation.summary.passed} superati,{' '}
              {source.payrollValidation.summary.warnings} con avvisi,{' '}
              {source.payrollValidation.summary.failed} non coerenti,{' '}
              {source.payrollValidation.summary.skipped} non eseguiti.
            </p>
          </div>
        )}

        {source.temporaryReadDiagnostic && (
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => exportReadDiagnostic(source)}
              className="h-10 w-full"
            >
              <FileText size={16} />
              Esporta diagnostica lettura
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button type="button" onClick={() => saveOne(source.importId)} className="h-12">
            <CheckCircle2 size={18} />
            Salva nello storico
          </Button>
          <Button type="button" variant="outline" onClick={() => setSelectedImportId(null)} className="h-12">
            Annulla
          </Button>
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} className="h-12">
            <Upload size={18} />
            Importa un altro PDF
          </Button>
        </div>
      </div>
    );
  };

  const renderHistoryDetail = (payslip: PayslipImport) => {
    const isEditing = editingHistoryId === payslip.id && historyDraft;
    const shown = isEditing ? historyDraft : payslip;

    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-500">Totale competenze</p>
            <p className="font-bold">{formatCurrency(shown.summary.grossAmount ?? shown.summary.totalEarnings)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Netto</p>
            <p className="font-bold">{formatCurrency(shown.summary.netAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Trasferte</p>
            <p className="font-bold">{getFieldValue(shown, numberFields.find((field) => field.key === 'travelDays')!) ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Domeniche</p>
            <p className="font-bold">{getFieldValue(shown, numberFields.find((field) => field.key === 'sundayDays')!) ?? '-'}</p>
          </div>
        </div>

        {isEditing && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {numberFields
              .filter((field) => ['grossAmount', 'netAmount', 'totalDeductions', 'travelDays', 'sundayDays'].includes(field.key))
              .map((field) =>
                renderNumberInput(shown, field, (nextField, value) => {
                  setHistoryDraft((current) => (current ? applyNumberField(current, nextField, normalizeNumberInput(value)) : current));
                })
              )}
            <Button type="button" onClick={saveHistoryDraft} className="h-11 sm:col-span-2">
              Salva correzioni
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderAnalysisValue = (value: string) => (
    <p className={`text-base font-extrabold ${value === 'Dato non disponibile' ? 'text-slate-500' : 'text-slate-900'}`}>
      {value}
    </p>
  );

  const renderMetricCard = (label: string, value: string) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      {renderAnalysisValue(value)}
    </div>
  );

  const renderMiniChart = (
    title: string,
    metricKey: DriverPayrollAnalysisMetricKey,
    valueFormatter: (value?: number) => string
  ) => {
    const points = historyAnalysis.monthly.filter((item) => typeof item.values[metricKey] === 'number');
    const maxValue = Math.max(...points.map((item) => item.values[metricKey] ?? 0), 0);

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 size={18} className="text-blue-700" />
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">{title}</h3>
        </div>
        {points.length < 2 || maxValue <= 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
            Dati insufficienti per visualizzare il grafico.
          </p>
        ) : (
          <div className="space-y-3">
            {points.map((item) => {
              const value = item.values[metricKey] ?? 0;
              const width = `${Math.max((value / maxValue) * 100, 4)}%`;
              return (
                <div key={`${metricKey}-${item.payslipId}`} className="grid grid-cols-[88px_1fr] items-center gap-3">
                  <span className="truncate text-xs font-semibold text-slate-600">{item.label}</span>
                  <div className="min-w-0">
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-600" style={{ width }} />
                    </div>
                    <p className="mt-1 text-xs font-bold text-slate-700">{valueFormatter(value)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderAnalysis = () => {
    const first = historyAnalysis.firstPayslip;
    const last = historyAnalysis.lastPayslip;
    const comparisonBaseReady = historyAnalysis.comparisonBase.length;

    return (
      <div className="space-y-4">
        {historyAnalysis.totalPayslips === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <BarChart3 size={34} className="mx-auto mb-3 text-slate-500" />
            <h2 className="text-lg font-extrabold text-slate-900">Nessun dato disponibile</h2>
            <p className="mt-1 text-sm text-slate-600">L'analisi usa solo le buste gia salvate nello storico locale.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {renderMetricCard('Totale buste archiviate', String(historyAnalysis.totalPayslips))}
              {renderMetricCard('Periodo coperto', historyAnalysis.periodCovered ?? 'Dato non disponibile')}
              {renderMetricCard('Prima busta', first?.label ?? 'Dato non disponibile')}
              {renderMetricCard('Ultima busta', last?.label ?? 'Dato non disponibile')}
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Medie storico</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {renderMetricCard('Netto', formatAnalysisCurrency(historyAnalysis.averages.netAmount))}
                {renderMetricCard('Lordo', formatAnalysisCurrency(historyAnalysis.averages.grossAmount))}
                {renderMetricCard('Trasferte', formatAnalysisNumber(historyAnalysis.averages.travelDays))}
                {renderMetricCard('Straordinari', formatAnalysisNumber(historyAnalysis.averages.overtimeHours))}
                {renderMetricCard('Premi', formatAnalysisCurrency(historyAnalysis.averages.bonusAmount))}
                {renderMetricCard('Ferie', formatAnalysisNumber(historyAnalysis.averages.vacationDays))}
                {renderMetricCard('Permessi', formatAnalysisNumber(historyAnalysis.averages.permitHours))}
                {renderMetricCard('Malattie', formatAnalysisNumber(historyAnalysis.averages.sicknessDays))}
                {renderMetricCard('Festivita', formatAnalysisNumber(historyAnalysis.averages.holidayDays))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {renderMiniChart('Netto mese per mese', 'netAmount', formatAnalysisCurrency)}
              {renderMiniChart('Lordo mese per mese', 'grossAmount', formatAnalysisCurrency)}
              {renderMiniChart('Trasferte mese per mese', 'travelDays', formatAnalysisNumber)}
              {renderMiniChart('Straordinari mese per mese', 'overtimeHours', formatAnalysisNumber)}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-700">Trend</h2>
              {historyAnalysis.trends.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  Dati insufficienti per calcolare trend affidabili.
                </p>
              ) : (
                <div className="space-y-2">
                  {historyAnalysis.trends.map((trend) => (
                    <div key={`${trend.key}-${trend.direction}`} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-800">
                      {trend.direction === 'up' ? (
                        <TrendingUp size={18} className="text-emerald-700" />
                      ) : (
                        <TrendingDown size={18} className="text-amber-700" />
                      )}
                      <span>{trend.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="payroll-historical-validation">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Andamento storico</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Controlli dinamici sui cedolini locali; i valori ufficiali non vengono modificati.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700">
                  {historicalValidation.overallStatus} · {historicalValidation.confidence}%
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {renderMetricCard('Controlli superati', String(historicalValidation.summary.passed))}
                {renderMetricCard('Segnalazioni', String(historicalValidation.summary.warnings))}
                {renderMetricCard('Incoerenze', String(historicalValidation.summary.failed))}
                {renderMetricCard('Non verificabili', String(historicalValidation.summary.skipped))}
              </div>
              <div className="mt-3 space-y-2">
                {historicalValidation.timeline.map((item) => (
                  <div key={item.payslipId} className="flex flex-wrap justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm">
                    <span className="font-extrabold text-slate-900">{item.label}</span>
                    <span className="font-semibold text-slate-600">{item.documentType}</span>
                  </div>
                ))}
              </div>
              {(historicalValidation.warnings.length > 0 || historicalValidation.errors.length > 0) && (
                <div className="mt-3 space-y-2">
                  {[...historicalValidation.errors, ...historicalValidation.warnings].slice(0, 5).map((message, index) => (
                    <p key={`${message}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                      {message}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <span className="sr-only" data-testid="payroll-comparison-base-ready">
              {comparisonBaseReady}
            </span>
          </>
        )}
      </div>
    );
  };

  const getComparisonSeverityClass = (severity: DriverPayrollComparisonRow['severity']) => {
    if (severity === 'match') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    if (severity === 'small') return 'border-amber-200 bg-amber-50 text-amber-900';
    if (severity === 'large') return 'border-red-200 bg-red-50 text-red-800';
    return 'border-slate-200 bg-slate-50 text-slate-600';
  };

  const getComparisonSeverityLabel = (severity: DriverPayrollComparisonRow['severity']) => {
    if (severity === 'match') return 'OK';
    if (severity === 'small') return 'Differenza piccola';
    if (severity === 'large') return 'Differenza importante';
    return 'Dato non disponibile';
  };

  const renderComparison = () => {
    if (comparisonBase.length === 0 || !selectedComparison) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <ReceiptText size={34} className="mx-auto mb-3 text-slate-500" />
          <h2 className="text-lg font-extrabold text-slate-900">Nessun riepilogo mese disponibile</h2>
          <p className="mt-1 text-sm text-slate-600">Il confronto usa solo buste e previsioni salvate localmente.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Label htmlFor="comparison-month" className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Mese
          </Label>
          <select
            id="comparison-month"
            value={`${selectedComparison.year}-${selectedComparison.month}`}
            onChange={(event) => setSelectedComparisonPeriod(event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 shadow-sm"
          >
            {comparisonBase.map((entry) => (
              <option key={`${entry.year}-${entry.month}`} value={`${entry.year}-${entry.month}`}>
                {monthNames[entry.month - 1] ?? 'Mese da verificare'} {entry.year}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr] gap-2 border-b border-slate-200 px-3 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-500">
            <span>Voce</span>
            <span>Previsto</span>
            <span>Reale</span>
            <span>Differenza</span>
          </div>
          <div className="divide-y divide-slate-100">
            {selectedComparison.rows.map((row) => (
              <div key={row.key} className="grid grid-cols-[1.1fr_1fr_1fr_1fr] items-center gap-2 px-3 py-3 text-sm">
                <span className="font-extrabold text-slate-900">{row.label}</span>
                <span className="font-semibold text-slate-700">{formatComparisonValue(row.predicted)}</span>
                <span className="font-semibold text-slate-700">{formatComparisonValue(row.actual)}</span>
                <div>
                  <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-extrabold ${getComparisonSeverityClass(row.severity)}`}>
                    {row.difference === undefined ? 'Dato non disponibile' : formatComparisonValue(row.difference)}
                  </span>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">{getComparisonSeverityLabel(row.severity)}</p>
                  {row.explanationSeeds.length > 0 && (
                    <span className="sr-only" data-testid={`comparison-explanation-${row.key}`}>
                      {row.explanationSeeds.map((seed) => seed.label).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <span className="sr-only" data-testid="comparison-ccnl-link-ready">
          {selectedComparison.rows.flatMap((row) => row.explanationSeeds).length}
        </span>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-700">Possibili spiegazioni</h2>
          {selectedComparisonExplanations.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              Nessuna differenza importante da interpretare.
            </p>
          ) : (
            <div className="space-y-3">
              {selectedComparisonExplanations.map((explanation) => (
                <div key={explanation.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">{explanation.title}</p>
                      <p className="text-xs font-semibold text-slate-500">{explanation.metricLabel}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-extrabold text-slate-700">
                      {explanation.confidence}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{explanation.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSimulatorStat = (label: string, value: number | string) => (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-extrabold text-slate-900">{value}</p>
    </div>
  );

  const manualLineKinds: Array<{ value: DriverPayrollSimulatorManualLineKind; label: string }> = [
    { value: 'authorized_overtime', label: 'Straordinario autorizzato' },
    { value: 'expense_reimbursement', label: 'Rimborso spese' },
    { value: 'damage_deduction', label: 'Trattenuta danni' },
    { value: 'advance_recovery', label: 'Recupero anticipo' },
    { value: 'manual_bonus', label: 'Bonus manuale' },
    { value: 'manual_deduction', label: 'Trattenuta manuale' },
    { value: 'other_positive', label: 'Altra voce positiva' },
    { value: 'other_negative', label: 'Altra voce negativa' },
  ];

  const renderSimulator = () => {
    const summary = simulator.eventSummary;
    const estimate = simulator.estimate;
    const hasPartialForecast = estimate.requiresManualInputs.length > 0 || estimate.warnings.length > 0;
    const travelLine = estimate.predictedLines.find((line) => line.code === '2310');
    const sundayLine = estimate.predictedLines.find((line) => line.code === '2315');
    const overtimeLines = estimate.predictedLines.filter((line) => line.code === '2030' || line.code === '2250');
    const manualLines = estimate.predictedLines.filter((line) => line.section === 'manual');

    return (
      <div className="space-y-4">
        {predictions.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <ReceiptText size={34} className="mx-auto mb-3 text-slate-500" />
            <h2 className="text-lg font-extrabold text-slate-900">Nessun riepilogo mensile salvato</h2>
            <p className="mt-1 text-sm text-slate-600">I riepiloghi salvati restano solo sul dispositivo.</p>
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="simulator-month" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Mese
              </Label>
              <select
                id="simulator-month"
                value={simulatorMonth}
                onChange={(event) => setSimulatorMonth(Number(event.target.value))}
                className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 shadow-sm"
              >
                {monthNames.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="simulator-year" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Anno
              </Label>
              <Input
                id="simulator-year"
                type="number"
                value={simulatorYear}
                onChange={(event) => setSimulatorYear(Number(event.target.value) || now.getFullYear())}
                className="mt-2 h-11"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {renderSimulatorStat('Giorni lavorati', summary.workedDays)}
          {renderSimulatorStat('Ferie', summary.vacationDays)}
          {renderSimulatorStat('Permessi/ROL', `${summary.permitDays} giorni / ${summary.permitHours} ore`)}
          {renderSimulatorStat('Malattia', summary.sicknessDays)}
          {renderSimulatorStat('Infortunio', summary.injuryDays)}
          {renderSimulatorStat('Riposi', summary.restDays)}
          {renderSimulatorStat('Abort', summary.abortDays)}
          {renderSimulatorStat('Visite mediche', summary.medicalVisitDays)}
          {renderSimulatorStat('Domeniche lavorate', summary.sundaysWorked)}
          {renderSimulatorStat('Festivita lavorate', summary.holidaysWorked)}
          {renderSimulatorStat('Festivita non lavorate', summary.holidaysNotWorked)}
          {renderSimulatorStat('Ex festivita', summary.exHolidayDays)}
          {renderSimulatorStat('Straordinari manuali', summary.authorizedOvertimeHours)}
          {renderSimulatorStat('Eventi trovati', simulator.input.attendanceEvents.length)}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-700">Voci manuali</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input placeholder="Ore straordinario 30%" value={authorizedOvertime30Hours} onChange={(event) => setAuthorizedOvertime30Hours(event.target.value)} />
            <Input placeholder="Importo ora 30%" value={overtime30HourlyAmount} onChange={(event) => setOvertime30HourlyAmount(event.target.value)} />
            <Input placeholder="Ore straordinario 50%" value={authorizedOvertime50Hours} onChange={(event) => setAuthorizedOvertime50Hours(event.target.value)} />
            <Input placeholder="Importo ora 50%" value={overtime50HourlyAmount} onChange={(event) => setOvertime50HourlyAmount(event.target.value)} />
          </div>

          <div className="mt-3 space-y-3">
            {simulatorManualLines.map((line) => (
              <div key={line.id} className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_120px]">
                <select
                  value={line.kind}
                  onChange={(event) => updateManualLine(line.id, { kind: event.target.value as DriverPayrollSimulatorManualLineKind })}
                  className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold"
                >
                  {manualLineKinds.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Descrizione"
                  value={line.description}
                  onChange={(event) => updateManualLine(line.id, { description: event.target.value })}
                />
                <Input
                  placeholder="Importo"
                  value={line.amount || ''}
                  onChange={(event) => updateManualLine(line.id, { amount: normalizeNumberInput(event.target.value) ?? 0 })}
                />
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={addManualLine} className="mt-3 h-11 w-full">
            <Plus size={17} />
            Aggiungi voce manuale
          </Button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-extrabold text-slate-900">Riepilogo del mese</h2>
          <p className="mt-1 text-sm text-slate-600">Riepilogo basato sui Turni Driver e sulle sole voci note.</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {renderSimulatorStat('Giorni con trasferta', estimate.summary.eligibleTravelDays)}
            {renderSimulatorStat('Importo unitario trasferta', formatCurrency(travelLine?.unitValue))}
            {renderSimulatorStat(
              'Totale trasferte',
              travelLine?.amount !== undefined
                ? `${travelLine.quantity ?? estimate.summary.eligibleTravelDays} × ${formatCurrency(travelLine.unitValue)} = ${formatCurrency(travelLine.amount)}`
                : 'Nessun dato disponibile'
            )}
            {renderSimulatorStat('Maggiorazione domenicale', sundayLine?.amount !== undefined ? formatCurrency(sundayLine.amount) : 'Nessun dato disponibile')}
          </div>

          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Straordinari inseriti manualmente</h3>
            {overtimeLines.length > 0 ? overtimeLines.map((line) => (
              <p key={`${line.code}-${line.label}`} className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-800">
                {line.label}: {line.quantity ?? 0} ore × {formatCurrency(line.unitValue)} = {formatCurrency(line.amount)}
              </p>
            )) : <p className="text-sm text-slate-600">Nessun dato inserito.</p>}
          </div>

          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Bonus, rimborsi e trattenute manuali</h3>
            {manualLines.length > 0 ? manualLines.map((line) => (
              <p key={`${line.label}-${line.amount}`} className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-800">
                {line.label}: {line.type === 'deduction' ? '-' : '+'}{formatCurrency(line.amount)}
              </p>
            )) : <p className="text-sm text-slate-600">Nessun dato inserito.</p>}
          </div>

          <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-900">
            Questa sezione non calcola lo stipendio netto o lordo: riepiloga solo presenze e componenti note.
          </p>
          {hasPartialForecast && (
            <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              Riepilogo parziale: servono piu buste paga importate o dati aggiuntivi.
            </p>
          )}
          {(estimate.warnings.length > 0 || estimate.requiresManualInputs.length > 0) && (
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              {[...estimate.warnings, ...estimate.requiresManualInputs].map((warning) => (
                <p key={warning}>- {warning}</p>
              ))}
            </div>
          )}

          <Button type="button" onClick={saveSimulatorPrediction} className="mt-4 h-12 w-full">
            <Save size={18} />
            Salva riepilogo locale
          </Button>
        </div>
      </div>
    );
  };

  const askAssistant = (question = assistantQuestion) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    const response = answerDriverPayrollQuestion({
      question: trimmed,
      year: assistantYear,
      month: assistantMonth,
      payslipHistory: history,
      predictions,
      comparison: assistantComparison,
      ruleExplanations: assistantRuleExplanations,
      simulation: assistantSimulation,
    });
    setAssistantQuestion(trimmed);
    setAssistantResponse(response);
  };

  const renderAssistant = () => {
    const quickQuestions = [
      'Quanti giorni ho lavorato questo mese?',
      "Perche c'e questa differenza?",
      'Quante trasferte risultano questo mese?',
      'Quanti giorni di ferie ho registrato?',
      'Quanti permessi ho registrato?',
      'Quali dati mancano?',
      'Qual e la media netta?',
    ];

    return (
      <div className="space-y-4">
        {!assistantResponse && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <ReceiptText size={34} className="mx-auto mb-3 text-slate-500" />
            <h2 className="text-lg font-extrabold text-slate-900">Nessun dato disponibile</h2>
            <p className="mt-1 text-sm text-slate-600">L'assistente usa solo storico, previsioni e confronti locali.</p>
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="assistant-month" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Mese
              </Label>
              <select
                id="assistant-month"
                value={assistantMonth}
                onChange={(event) => setAssistantMonth(Number(event.target.value))}
                className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 shadow-sm"
              >
                {monthNames.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="assistant-year" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Anno
              </Label>
              <Input
                id="assistant-year"
                type="number"
                value={assistantYear}
                onChange={(event) => setAssistantYear(Number(event.target.value) || now.getFullYear())}
                className="mt-2 h-11"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Label htmlFor="assistant-question" className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Domanda
          </Label>
          <Textarea
            id="assistant-question"
            value={assistantQuestion}
            onChange={(event) => setAssistantQuestion(event.target.value)}
            placeholder="Chiedi qualcosa sui dati payroll locali..."
            className="mt-2 min-h-24 text-base"
          />
          <Button type="button" onClick={() => askAssistant()} className="mt-3 h-11 w-full">
            Chiedi
          </Button>
          <div className="mt-3 flex flex-wrap gap-2">
            {quickQuestions.map((question) => (
              <Button key={question} type="button" variant="outline" size="sm" onClick={() => askAssistant(question)}>
                {question}
              </Button>
            ))}
          </div>
        </div>

        {assistantResponse && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="assistant-response">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Risposta</p>
                <h2 className="text-lg font-extrabold text-slate-900">{assistantResponse.title}</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700">
                Confidence: {assistantResponse.confidence}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-800">{assistantResponse.answer}</p>
            {(assistantResponse.details?.length ?? 0) > 0 && (
              <div className="mt-3 space-y-1 text-sm text-slate-700">
                {assistantResponse.details?.map((detail) => (
                  <p key={detail}>- {detail}</p>
                ))}
              </div>
            )}
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Fonti usate</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {assistantResponse.sourceTypes.length > 0 ? (
                  assistantResponse.sourceTypes.map((source) => (
                    <span key={source} className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">
                      {source}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">Nessuna fonte disponibile</span>
                )}
              </div>
            </div>
            {(assistantResponse.warnings?.length ?? 0) > 0 && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                {assistantResponse.warnings?.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}
            {(assistantResponse.suggestedQuestions?.length ?? 0) > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Domande suggerite</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {assistantResponse.suggestedQuestions?.map((question) => (
                    <Button key={question} type="button" variant="secondary" size="sm" onClick={() => askAssistant(question)}>
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
      <PageHeader
        title="Busta Paga Driver"
        subtitle="Importa, controlla e conserva localmente i dati delle tue buste paga"
        theme="payroll"
        icon={ReceiptText}
        backTo="/turni-e-busta-paga"
      />

      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">
        <ReceiptText size={14} />
        Driver Payroll Engine
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl sm:grid-cols-6">
          <TabsTrigger value="import" className="rounded-lg">
            Importa
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg">
            Storico
          </TabsTrigger>
          <TabsTrigger value="analysis" className="rounded-lg">
            Analisi
          </TabsTrigger>
          <TabsTrigger value="comparison" className="rounded-lg">
            Confronto
          </TabsTrigger>
          <TabsTrigger value="simulator" className="rounded-lg">
            Mese
          </TabsTrigger>
          <TabsTrigger value="assistant" className="rounded-lg">
            Assistente
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="mt-4 space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm">
            <button
              type="button"
              onClick={() => setIsPrivacyOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              aria-expanded={isPrivacyOpen}
              aria-controls="payroll-privacy-content"
            >
              <span className="flex items-center gap-2 text-sm font-extrabold">
                <ShieldCheck size={18} />
                Privacy Payroll
              </span>
              {isPrivacyOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            {isPrivacyOpen && (
              <div id="payroll-privacy-content" className="px-4 pb-4 text-sm leading-relaxed">
                {DRIVER_PAYROLL_IMPORT_PRIVACY_NOTE}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="sr-only"
              onChange={handleSelectFiles}
              aria-label="Seleziona busta paga PDF"
              data-testid="payroll-file-input"
            />
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="h-14 w-full text-base font-bold"
            >
              {isImporting ? <Loader2 className="animate-spin" size={20} /> : <FileText size={20} />}
              Importa busta paga PDF
            </Button>
            {isImporting && (
              <p className="mt-3 text-center text-sm font-semibold text-slate-700" role="status">
                Analisi della busta paga in corso...
              </p>
            )}
          </div>

          {results.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-extrabold text-slate-900">Risultati importazione</h2>
                {Object.keys(editable).length > 1 && (
                  <Button type="button" size="sm" onClick={saveAllValid}>
                    Salva tutte le buste valide
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {results.map((result) => (
                  <button
                    key={result.importId}
                    type="button"
                    onClick={() => setSelectedImportId(result.importId)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedResult?.importId === result.importId ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">{result.payslip ? getPeriodLabel(result.payslip) : result.fileName}</p>
                        <p className="text-sm text-slate-600">
                          {result.status === 'failed'
                            ? result.errors[0]?.message
                            : result.status === 'warning'
                              ? 'Pronto da verificare'
                              : 'Pronto da verificare'}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-bold ${
                          result.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : result.status === 'warning'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {result.status === 'failed' ? 'Errore' : result.status === 'warning' ? 'Da controllare' : 'Pronto'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedResult?.status === 'failed' && (
            <div className="space-y-3">
              <Alert variant="destructive">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle>PDF non importato</AlertTitle>
                <AlertDescription>{selectedResult.errors[0]?.message}</AlertDescription>
              </Alert>
              {selectedResult.temporaryReadDiagnostic && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => exportReadDiagnostic(selectedResult)}
                  className="h-11 w-full"
                >
                  <FileText size={17} />
                  Esporta diagnostica lettura
                </Button>
              )}
            </div>
          )}

          {selectedEditable && renderPreview(selectedEditable)}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {sortedHistory.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <ReceiptText size={34} className="mx-auto mb-3 text-slate-500" />
              <h2 className="text-lg font-extrabold text-slate-900">Nessuna busta importata</h2>
              <p className="mt-1 text-sm text-slate-600">Importa il primo PDF per creare il tuo storico personale.</p>
              <Button type="button" onClick={() => setActiveTab('import')} className="mt-4 h-11">
                Importa busta paga
              </Button>
            </div>
          ) : (
            sortedHistory.map((payslip) => (
              <div key={payslip.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">{getPeriodLabel(payslip)}</h2>
                    <p className="text-sm text-slate-600">
                      Netto {formatCurrency(payslip.summary.netAmount)} - Totale competenze{' '}
                      {formatCurrency(payslip.summary.grossAmount ?? payslip.summary.totalEarnings)}
                    </p>
                    <p className="text-xs text-slate-500">Importata il {formatDateTime(payslip.importedAt)}</p>
                  </div>
                  {(payslip.warnings?.length ?? 0) > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">Da verificare</span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpenedHistoryId(openedHistoryId === payslip.id ? null : payslip.id)}>
                    Apri
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => startEditHistory(payslip)}>
                    <Edit3 size={16} />
                    Modifica
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => deleteHistoryItem(payslip)}>
                    <Trash2 size={16} />
                    Elimina
                  </Button>
                </div>

                {openedHistoryId === payslip.id && renderHistoryDetail(payslip)}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="analysis" className="mt-4">
          {renderAnalysis()}
        </TabsContent>

        <TabsContent value="comparison" className="mt-4">
          {renderComparison()}
        </TabsContent>

        <TabsContent value="simulator" className="mt-4">
          {renderSimulator()}
        </TabsContent>

        <TabsContent value="assistant" className="mt-4">
          {renderAssistant()}
        </TabsContent>
      </Tabs>

      <div className="mt-6 rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Impostazioni Payroll</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Reset completo dei soli dati locali del Driver Payroll Engine.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="h-11" disabled={isResettingPayroll}>
                <Trash2 size={17} />
                Reset dati Payroll
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Driver Payroll</AlertDialogTitle>
                <AlertDialogDescription>
                  Verranno eliminati tutti i dati locali del Driver Payroll.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3 text-sm text-slate-700">
                <div>
                  <p className="font-extrabold text-slate-900">Saranno cancellati:</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    <li>Storico buste</li>
                    <li>Analisi</li>
                    <li>Confronti</li>
                    <li>Simulazioni</li>
                    <li>Previsioni salvate</li>
                    <li>Dati Assistente Payroll</li>
                    <li>Fingerprint dei PDF</li>
                    <li>Cache Parser Payroll</li>
                    <li>Eventuali dati temporanei del Payroll</li>
                  </ul>
                </div>
                <div>
                  <p className="font-extrabold text-slate-900">NON verranno eliminati:</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    <li>QR Locali</li>
                    <li>Turni Driver</li>
                    <li>Driver PDF Finder</li>
                    <li>Cloud</li>
                    <li>Supabase</li>
                    <li>altre funzioni dell'app</li>
                  </ul>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetPayroll} className="bg-red-600 text-white hover:bg-red-700">
                  Elimina tutto
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default DriverPayroll;
