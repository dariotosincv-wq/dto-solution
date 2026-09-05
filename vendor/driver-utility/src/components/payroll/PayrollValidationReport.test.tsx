import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { DriverPayrollValidationIntegrationResult } from '@/lib/driverPayrollImportTypes';
import type {
  DriverPayrollValidationIndicator,
  DriverPayrollValidationOverallStatus,
  DriverPayrollValidationReport,
} from '@/lib/payrollValidationEngine/driverValidationReportTypes';
import { PayrollValidationReport } from './PayrollValidationReport';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

const makeReport = (
  overallStatus: DriverPayrollValidationOverallStatus = 'OK',
  indicators: DriverPayrollValidationIndicator[] = ['GREEN']
): DriverPayrollValidationReport => ({
  summary: {
    totalResults: indicators.length,
    correctCount: 1,
    checkCount: 2,
    problemCount: 3,
    informationCount: 4,
    technicalProblemCount: 1,
    overallStatus,
    message: 'Riepilogo leggibile del controllo.',
  },
  items: indicators.map((indicator, index) => ({
    title: `Controllo ${index + 1}`,
    userStatus: indicator === 'GREEN' ? 'CORRECT' : indicator === 'YELLOW' ? 'CHECK' : indicator === 'RED' ? 'PROBLEM' : 'INFORMATION',
    indicator,
    checked: 'Dato osservato',
    expected: index === 0 ? { text: '100,00 EUR', unit: 'EUR' } : undefined,
    actual: index === 0 ? { text: '99,00 EUR', unit: 'EUR' } : undefined,
    difference: index === 0 ? { text: '1,00 EUR', unit: 'EUR' } : undefined,
    tolerance: index === 0 ? { text: '0,01 EUR', unit: 'EUR' } : undefined,
    shortExplanation: 'Spiegazione breve.',
    detailedExplanation: 'Spiegazione completa.',
    suggestion: 'Verificare il cedolino.',
    missingInformation: index === 0 ? ['Aliquota osservata'] : [],
  })),
  technicalProblems: [{ message: 'Problema tecnico leggibile' }],
  technical: {
    runExecutedAt: '2026-07-31T10:00:00.000Z',
    executedChecks: indicators.length,
    skippedChecks: 0,
    internalErrors: [{
      checkId: 'technical.check',
      checkVersion: '1.0.0',
      stage: 'EXECUTION',
      errorName: 'Error',
      message: 'Errore interno',
    }],
    items: indicators.map((_, index) => ({
      checkId: `fiscal.check-${index + 1}`,
      version: '1.0.0',
      category: 'FISCAL',
      confidence: 0.95,
      evidence: [],
      missingInputs: [],
      ruleSource: {
        id: 'source.id',
        version: '1.0.0',
        sourceType: 'LAW',
        status: 'CONFIRMED',
        confidence: 1,
      },
      executedAt: '2026-07-31T10:00:00.000Z',
    })),
  },
});

const completed = (report = makeReport()): DriverPayrollValidationIntegrationResult => ({
  status: 'COMPLETED',
  profile: 'PRODUCTION',
  serviceSource: 'FISCAL_V1',
  selectedCheckIds: [],
  driverReport: report,
  executedAt: '2026-07-31T10:00:00.000Z',
});

const render = (validationPipeline?: DriverPayrollValidationIntegrationResult) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root?.render(<PayrollValidationReport validationPipeline={validationPipeline} />));
  return host;
};

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('PayrollValidationReport', () => {
  it('non altera la UI legacy quando la pipeline non e presente', () => {
    expect(render().textContent).toBe('');
  });

  it.each([
    ['OK', 'Controlli completati', false],
    ['ATTENTION', 'Da verificare', true],
    ['ISSUE', 'Anomalia rilevata', true],
    ['INCOMPLETE', 'Controllo incompleto', true],
  ] as const)('rende lo stato %s e applica la policy di apertura', (status, label, open) => {
    const element = render(completed(makeReport(status)));
    expect(element.textContent).toContain(label);
    expect(element.querySelector<HTMLDetailsElement>('details')?.open).toBe(open);
    expect(element.querySelector(`[aria-label="Stato generale: ${label}"]`)).not.toBeNull();
  });

  it('mostra conteggi, indicatori e soli valori disponibili', () => {
    const element = render(completed(makeReport('ATTENTION', ['GREEN', 'YELLOW', 'RED', 'BLUE'])));
    expect(element.textContent).toContain('Superati1');
    expect(element.textContent).toContain('Da verificare2');
    expect(element.textContent).toContain('Anomalie3');
    expect(element.textContent).toContain('Informativi4');
    for (const label of ['Coerente', 'Da verificare', 'Anomalia', 'Informazione']) {
      expect(element.querySelector(`[aria-label="Esito: ${label}"]`)).not.toBeNull();
    }
    for (const value of ['Atteso', 'Rilevato', 'Differenza', 'Tolleranza', 'Aliquota osservata']) {
      expect(element.textContent).toContain(value);
    }
    expect(element.textContent?.match(/Atteso/g)).toHaveLength(1);
  });

  it('mantiene chiusi i dettagli tecnici e permette di espanderli', () => {
    const element = render(completed());
    const details = element.querySelectorAll<HTMLDetailsElement>('details');
    expect(details[1].open).toBe(false);
    act(() => details[1].querySelector('summary')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(details[1].open).toBe(true);
    expect(element.textContent).toContain('ID controllo: fiscal.check-1');
    expect(element.textContent).toContain('Errore interno');
  });

  it.each([
    ['NOT_RUN', 'Controllo della busta paga non eseguito'],
    ['TECHNICAL_ERROR', 'Controllo automatico non completato'],
  ] as const)('gestisce lo stato pipeline %s', (status, message) => {
    const element = render({ status, profile: 'PRODUCTION', selectedCheckIds: [] });
    expect(element.textContent).toContain(message);
    expect(element.querySelector('[aria-label="Controllo della busta paga"]')).not.toBeNull();
  });

  it('e serializzabile e non modifica il report ricevuto', () => {
    const report = makeReport();
    const before = JSON.stringify(report);
    render(completed(report));
    expect(JSON.stringify(report)).toBe(before);
    expect(() => JSON.stringify(completed(report))).not.toThrow();
  });
});
