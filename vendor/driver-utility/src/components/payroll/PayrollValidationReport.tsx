import { AlertCircle, CheckCircle2, CircleHelp, Info, Wrench } from 'lucide-react';
import type {
  DriverPayrollValidationIndicator,
  DriverPayrollValidationOverallStatus,
} from '@/lib/payrollValidationEngine/driverValidationReportTypes';
import type { DriverPayrollValidationIntegrationResult } from '@/lib/driverPayrollImportTypes';

export interface PayrollValidationReportProps {
  readonly validationPipeline?: DriverPayrollValidationIntegrationResult;
}

const overallStyle: Record<DriverPayrollValidationOverallStatus, string> = {
  OK: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  ATTENTION: 'border-amber-300 bg-amber-50 text-amber-950',
  ISSUE: 'border-red-300 bg-red-50 text-red-950',
  INCOMPLETE: 'border-blue-200 bg-blue-50 text-blue-950',
};

const overallLabel: Record<DriverPayrollValidationOverallStatus, string> = {
  OK: 'Controlli completati',
  ATTENTION: 'Da verificare',
  ISSUE: 'Anomalia rilevata',
  INCOMPLETE: 'Controllo incompleto',
};

const indicatorStyle: Record<DriverPayrollValidationIndicator, string> = {
  GREEN: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  YELLOW: 'border-amber-200 bg-amber-50 text-amber-900',
  RED: 'border-red-200 bg-red-50 text-red-900',
  BLUE: 'border-blue-200 bg-blue-50 text-blue-900',
};

const indicatorLabel: Record<DriverPayrollValidationIndicator, string> = {
  GREEN: 'Coerente',
  YELLOW: 'Da verificare',
  RED: 'Anomalia',
  BLUE: 'Informazione',
};

const statusIcon = (status: DriverPayrollValidationOverallStatus) => {
  if (status === 'OK') return <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />;
  if (status === 'ISSUE') return <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0" />;
  if (status === 'ATTENTION') return <CircleHelp aria-hidden="true" className="h-5 w-5 shrink-0" />;
  return <Info aria-hidden="true" className="h-5 w-5 shrink-0" />;
};

export function PayrollValidationReport({
  validationPipeline,
}: PayrollValidationReportProps) {
  if (!validationPipeline) return null;

  if (validationPipeline.status === 'NOT_RUN') {
    return (
      <section
        aria-label="Controllo della busta paga"
        className="min-w-0 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 shadow-sm"
        data-testid="payroll-validation-not-run"
      >
        <div className="flex items-start gap-2">
          <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <h3 className="font-extrabold">Controllo della busta paga non eseguito</h3>
            <p className="mt-1 break-words">
              Il controllo automatico non è stato eseguito perché mancano alcune informazioni necessarie, ma il cedolino può comunque essere importato.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (validationPipeline.status === 'TECHNICAL_ERROR') {
    return (
      <section
        aria-label="Controllo della busta paga"
        className="min-w-0 rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm text-slate-900 shadow-sm"
        data-testid="payroll-validation-technical-error"
      >
        <div className="flex items-start gap-2">
          <Wrench aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <h3 className="font-extrabold">Controllo automatico non completato</h3>
            <p className="mt-1 break-words">
              Il cedolino è stato letto, ma il controllo automatico non è stato completato per un problema tecnico. Può comunque essere importato.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const report = validationPipeline.driverReport;
  if (!report) return null;
  const { summary } = report;
  const detailsInitiallyOpen = summary.overallStatus !== 'OK';

  return (
    <section
      aria-labelledby="payroll-validation-title"
      className={`min-w-0 rounded-xl border p-4 text-sm shadow-sm ${overallStyle[summary.overallStatus]}`}
      data-testid="payroll-validation-report"
    >
      <div className="flex items-start gap-2">
        {statusIcon(summary.overallStatus)}
        <div className="min-w-0 flex-1">
          <h3 id="payroll-validation-title" className="font-extrabold">
            Controllo della busta paga
          </h3>
          <p className="mt-1 font-semibold" aria-label={`Stato generale: ${overallLabel[summary.overallStatus]}`}>
            {overallLabel[summary.overallStatus]}
          </p>
          <p className="mt-1 break-words">{summary.message}</p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Riepilogo dei controlli">
        <div className="rounded-lg bg-white/70 p-2"><dt className="text-xs">Superati</dt><dd className="font-extrabold">{summary.correctCount}</dd></div>
        <div className="rounded-lg bg-white/70 p-2"><dt className="text-xs">Da verificare</dt><dd className="font-extrabold">{summary.checkCount}</dd></div>
        <div className="rounded-lg bg-white/70 p-2"><dt className="text-xs">Anomalie</dt><dd className="font-extrabold">{summary.problemCount}</dd></div>
        <div className="rounded-lg bg-white/70 p-2"><dt className="text-xs">Informativi</dt><dd className="font-extrabold">{summary.informationCount}</dd></div>
      </dl>

      <details className="mt-3 rounded-lg border border-current/20 bg-white/60" open={detailsInitiallyOpen}>
        <summary className="min-h-11 cursor-pointer px-3 py-3 font-bold focus-visible:outline focus-visible:outline-2">
          Dettagli dei controlli
        </summary>
        <div className="space-y-3 border-t border-current/20 p-3" data-testid="payroll-validation-readable-details">
          {report.items.map((item, index) => (
            <article key={`${item.title}-${index}`} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 text-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="min-w-0 break-words font-extrabold">{item.title}</h4>
                <span
                  className={`rounded-full border px-2 py-1 text-xs font-bold ${indicatorStyle[item.indicator]}`}
                  aria-label={`Esito: ${indicatorLabel[item.indicator]}`}
                >
                  {indicatorLabel[item.indicator]}
                </span>
              </div>
              <p className="mt-2 break-words font-semibold">{item.shortExplanation}</p>
              {(item.expected || item.actual || item.difference || item.tolerance) && (
                <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {item.expected && <div><dt className="text-xs text-slate-500">Atteso</dt><dd className="break-words font-bold">{item.expected.text}</dd></div>}
                  {item.actual && <div><dt className="text-xs text-slate-500">Rilevato</dt><dd className="break-words font-bold">{item.actual.text}</dd></div>}
                  {item.difference && <div><dt className="text-xs text-slate-500">Differenza</dt><dd className="break-words font-bold">{item.difference.text}</dd></div>}
                  {item.tolerance && <div><dt className="text-xs text-slate-500">Tolleranza</dt><dd className="break-words font-bold">{item.tolerance.text}</dd></div>}
                </dl>
              )}
              <p className="mt-2 break-words">{item.detailedExplanation}</p>
              <p className="mt-2 break-words font-semibold">Cosa fare: {item.suggestion}</p>
              {item.missingInformation.length > 0 && (
                <div className="mt-2">
                  <p className="font-bold">Informazioni mancanti</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {item.missingInformation.map((missing, missingIndex) => (
                      <li key={`${missing}-${missingIndex}`} className="break-words">{missing}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </div>
      </details>

      <details className="mt-3 rounded-lg border border-slate-300 bg-white text-slate-900">
        <summary className="min-h-11 cursor-pointer px-3 py-3 font-bold focus-visible:outline focus-visible:outline-2">
          Dettagli tecnici
        </summary>
        <div className="space-y-3 border-t border-slate-200 p-3 text-xs" data-testid="payroll-validation-technical-details">
          {report.technical.items.map((detail, index) => (
            <article key={`${detail.checkId}-${index}`} className="min-w-0 rounded-lg bg-slate-50 p-3">
              <p className="break-all font-bold">ID controllo: {detail.checkId}</p>
              <p>Versione: {detail.version}</p>
              <p>Categoria: {detail.category}</p>
              <p>Esito report: {report.items[index]?.userStatus ?? 'Non disponibile'}</p>
              <p>Confidence: {detail.confidence}</p>
              <p>Timestamp: {detail.executedAt}</p>
              {detail.missingInputs.length > 0 && <p>Dati mancanti: {detail.missingInputs.map((item) => item.description).join(', ')}</p>}
              {detail.ruleSource && <p>Sorgente regola: {detail.ruleSource.id} ({detail.ruleSource.sourceType})</p>}
              <p>Evidenze disponibili: {detail.evidence.length}</p>
            </article>
          ))}
          {report.technical.internalErrors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
              <p className="font-bold">Problemi tecnici dei controlli</p>
              <ul className="mt-1 list-disc pl-5">
                {report.technical.internalErrors.map((error, index) => (
                  <li key={`${error.checkId}-${index}`} className="break-words">
                    {error.checkId}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
