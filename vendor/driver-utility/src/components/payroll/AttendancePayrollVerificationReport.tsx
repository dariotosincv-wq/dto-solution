import type { PayslipImport } from '@/lib/driverPayrollTypes';
import { DEFAULT_DRIVER_CONTRACT_PROFILE, normalizeDriverContractProfile } from '@/lib/driverContractProfile';
import { summarizeMonthlyAttendance, type StoredAttendance } from '@/lib/monthlyAttendanceSummary';
import { adaptPayslipForAttendanceVerification, compareAttendanceWithPayroll } from '@/lib/payrollAttendanceVerification';

const months=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const readJson=<T,>(key:string,fallback:T):T=>{ try { const raw=localStorage.getItem(key); return raw?JSON.parse(raw):fallback; } catch { return fallback; } };

export function AttendancePayrollVerificationReport({payslip}:{payslip:PayslipImport}) {
  const attendance=readJson<StoredAttendance>('attendance',{});
  const profile=normalizeDriverContractProfile(readJson('driverContractProfile',DEFAULT_DRIVER_CONTRACT_PROFILE));
  const summary=summarizeMonthlyAttendance(attendance,payslip.year,payslip.month,profile);
  const report=compareAttendanceWithPayroll(summary,adaptPayslipForAttendanceVerification(payslip));
  const colors={OK:'border-emerald-200 bg-emerald-50 text-emerald-950',WARNING:'border-amber-300 bg-amber-50 text-amber-950',NOT_VERIFIABLE:'border-slate-200 bg-slate-50 text-slate-800',INFO:'border-blue-200 bg-blue-50 text-blue-950'};
  const labels={OK:'Corretto',WARNING:'Da verificare',NOT_VERIFIABLE:'Non verificabile',INFO:'Informazione'};
  const executed=report.totals.OK+report.totals.WARNING+report.totals.NOT_VERIFIABLE;
  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="attendance-payroll-verification">
    <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Controllo busta paga</h3>
    <p className="mt-1 font-extrabold text-slate-900">{months[payslip.month-1]} {payslip.year}</p>
    {!report.hasAttendance ? <p className="mt-3 text-sm text-slate-700">Non risultano Turni Driver registrati per {months[payslip.month-1]} {payslip.year}.</p> : <>
      {report.isAttendancePartial && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Il mese contiene giorni non compilati: il confronto potrebbe essere parziale.</p>}
      <p className="mt-3 text-sm font-semibold text-slate-700">{executed} controlli eseguiti: {report.totals.OK} corretti, {report.totals.WARNING} da verificare, {report.totals.NOT_VERIFIABLE} non verificabili.</p>
      <div className="mt-3 space-y-2">{report.checks.map(check=><div key={check.key} className={`rounded-lg border p-3 text-sm ${colors[check.status]}`}>
        <div className="flex justify-between gap-2"><span className="font-extrabold">{check.label}</span><span className="text-xs font-bold">{labels[check.status]}</span></div>
        {(check.attendanceValue!==undefined||check.payrollValue!==undefined)&&<p className="mt-1">Turni Driver: {check.attendanceValue ?? '-'} · Busta paga: {check.payrollValue ?? '-'}</p>}
        <p className="mt-1">{check.message}</p>
      </div>)}</div>
    </>}
  </section>;
}
