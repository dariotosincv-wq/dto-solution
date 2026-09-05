import type {
  AttendanceEvent,
  DriverPayrollCompanyProfile,
  DriverPayrollEstimateOptions,
  DriverPayrollEstimateResult,
  PayrollMonthInput,
  PayslipLine,
} from './driverPayrollTypes';
import { getTravelAllowanceForPeriod } from './driverPayrollCompanyProfiles';

const round2 = (value: number): number => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

const sumAmounts = (lines: PayslipLine[], type?: 'earning' | 'deduction'): number => {
  return round2(
    lines
      .filter((line) => !type || line.type === type)
      .reduce((total, line) => total + (line.amount ?? 0), 0)
  );
};

const isRealWorkedEvent = (event: AttendanceEvent): boolean => {
  if (event.isAbort) return false;
  if (['vacation', 'par', 'ex_holiday', 'sickness', 'injury', 'unpaid_leave'].includes(event.status)) {
    return false;
  }

  if (event.status === 'strike') {
    return (event.hoursWorked ?? 0) > 4;
  }

  return ['worked', 'sunday_worked', 'holiday_worked', 'training'].includes(event.status);
};

const isEligibleForTravel = (event: AttendanceEvent): boolean => {
  return isRealWorkedEvent(event) && (event.hoursWorked ?? 0) > 4;
};

const isPaidOrdinaryEvent = (event: AttendanceEvent): boolean => {
  return [
    'worked',
    'sunday_worked',
    'holiday_worked',
    'holiday_not_worked',
    'vacation',
    'par',
    'ex_holiday',
    'sickness',
    'injury',
    'abort',
    'training',
    'medical_visit',
  ].includes(event.status);
};

const pushLine = (lines: PayslipLine[], line: PayslipLine): void => {
  if (!line.quantity && !line.amount) return;
  lines.push(line);
};

function buildManualLines(options?: DriverPayrollEstimateOptions): PayslipLine[] {
  return (options?.manualLines ?? []).map((line) => ({
    code: line.code,
    label: line.label,
    amount: round2(line.amount),
    type: line.type,
    section: 'manual',
    confidence: 100,
    rawLine: line.notes,
  }));
}

function getEmploymentMode(companyProfile: DriverPayrollCompanyProfile): 'full_time' | 'part_time' {
  if (companyProfile.fullTimeDefault) return 'full_time';
  return companyProfile.defaultEmploymentType === 'full_time' ? 'full_time' : 'part_time';
}

export function estimateDriverPayroll(
  input: PayrollMonthInput,
  companyProfile: DriverPayrollCompanyProfile,
  options?: DriverPayrollEstimateOptions
): DriverPayrollEstimateResult {
  const warnings: string[] = [];
  const requiresManualInputs: string[] = [];
  const predictedLines: PayslipLine[] = [];
  const employmentMode = getEmploymentMode(companyProfile);

  const travelDailyAmount = getTravelAllowanceForPeriod(companyProfile, input.year, input.month);
  const travelEvents = input.attendanceEvents.filter(isEligibleForTravel);
  const sundayEvents = travelEvents.filter((event) => event.status === 'sunday_worked');
  const holidayWorkedEvents = travelEvents.filter((event) => event.status === 'holiday_worked');
  const paidOrdinaryEvents = input.attendanceEvents.filter(isPaidOrdinaryEvent);
  const realWorkedEvents = input.attendanceEvents.filter(isRealWorkedEvent);
  const abortEvents = input.attendanceEvents.filter((event) => event.status === 'abort');
  const sicknessEvents = input.attendanceEvents.filter((event) => event.status === 'sickness');
  const injuryEvents = input.attendanceEvents.filter((event) => event.status === 'injury');

  if (travelDailyAmount === undefined) {
    warnings.push('Trasferta non calcolata: manca una tariffa valida nel profilo azienda.');
    requiresManualInputs.push('Importo trasferta con decorrenza valida per il mese.');
  } else {
    pushLine(predictedLines, {
      code: '2310',
      label: 'Trasferta',
      quantity: travelEvents.length,
      unitValue: travelDailyAmount,
      amount: round2(travelEvents.length * travelDailyAmount),
      section: 'allowances',
      type: 'earning',
      linkedPayrollCode: '2310',
      linkedRuleId: 'rule_travel_allowance_real_worked_day',
      confidence: 85,
    });
  }

  if (sundayEvents.length > 0) {
    const sundayTravelExtra = companyProfile.sundayTravelExtraAmount;

    if (sundayTravelExtra === undefined) {
      warnings.push('Extra trasferta domenicale non calcolato: manca configurazione aziendale.');
      requiresManualInputs.push('Extra domenicale trasferta per voce 2315.');
    } else {
      pushLine(predictedLines, {
        code: '2315',
        label: 'Indennita lavoro domenicale',
        quantity: sundayEvents.length,
        unitValue: sundayTravelExtra,
        amount: round2(sundayEvents.length * sundayTravelExtra),
        section: 'allowances',
        type: 'earning',
        linkedPayrollCode: '2315',
        linkedRuleId: 'rule_sunday_travel_extra',
        confidence: 75,
      });
    }

    if (employmentMode === 'part_time') {
      warnings.push('Domenica part-time: trattamento da verificare, nessuna regola certa applicata.');
      requiresManualInputs.push('Conferma trattamento domenicale per part-time.');
    }

    if (companyProfile.sundayWorkPremiumAmount === undefined) {
      requiresManualInputs.push('Maggiorazione domenicale se pagata separatamente dalla voce 2315.');
    } else {
      pushLine(predictedLines, {
        label: 'Maggiorazione domenicale',
        quantity: sundayEvents.length,
        unitValue: companyProfile.sundayWorkPremiumAmount,
        amount: round2(sundayEvents.length * companyProfile.sundayWorkPremiumAmount),
        section: 'allowances',
        type: 'earning',
        linkedRuleId: 'rule_sunday_full_time',
        confidence: 65,
      });
    }
  }

  if (abortEvents.length > 0) {
    pushLine(predictedLines, {
      label: 'Giornate abort pagate come ordinarie',
      quantity: abortEvents.length,
      section: 'attendance',
      type: 'informational',
      linkedRuleId: 'rule_abort_paid_no_allowances',
      confidence: 70,
    });
  }

  if (input.vacationDays > 0) {
    pushLine(predictedLines, {
      code: '5000',
      label: 'Ferie godute',
      quantity: input.vacationDays,
      section: 'attendance',
      type: 'neutral',
      linkedPayrollCode: '5000',
      linkedRuleId: 'rule_paid_absences_no_travel',
      confidence: 80,
    });
  }

  if (input.parHours > 0) {
    pushLine(predictedLines, {
      code: '5050',
      label: 'P.A.R. godute',
      quantity: input.parHours,
      section: 'attendance',
      type: 'neutral',
      linkedPayrollCode: '5050',
      linkedRuleId: 'rule_paid_absences_no_travel',
      confidence: 75,
    });
  }

  if (sicknessEvents.length > 0) {
    warnings.push('Malattia: struttura base applicata, formula INPS/fiscale rimandata.');
    requiresManualInputs.push('Dettaglio busta malattia per distinguere carenza, INPS e integrazione azienda.');
    pushLine(predictedLines, {
      label: 'Malattia da stimare con dettaglio busta',
      quantity: sicknessEvents.length,
      section: 'attendance',
      type: 'informational',
      linkedRuleId: 'rule_sickness_base',
      confidence: 45,
    });
  }

  if (injuryEvents.length > 0) {
    warnings.push('Infortunio: regola placeholder, richiede verifica.');
    requiresManualInputs.push('Formula infortunio o busta reale di confronto.');
    pushLine(predictedLines, {
      label: 'Infortunio da verificare',
      quantity: injuryEvents.length,
      section: 'attendance',
      type: 'informational',
      linkedRuleId: 'rule_injury_requires_verification',
      confidence: 25,
    });
  }

  if (holidayWorkedEvents.length > 0 && companyProfile.sundayWorkPremiumAmount === undefined) {
    requiresManualInputs.push('Maggiorazione festivita lavorata se prevista separatamente.');
  }

  const holidaysOnSunday = input.attendanceEvents.filter((event) => event.isHoliday && event.isSunday);
  if (holidaysOnSunday.length > 0) {
    warnings.push('Festivo cadente di domenica: trattamento da verificare.');
  }

  const overtime30Hours = options?.authorizedOvertime30Hours ?? input.overtime30Hours;
  const overtime50Hours = options?.authorizedOvertime50Hours ?? input.overtime50Hours;

  if (overtime30Hours > 0) {
    if (options?.overtime30HourlyAmount === undefined) {
      requiresManualInputs.push('Importo orario straordinario/supplementare 30 autorizzato.');
    } else {
      pushLine(predictedLines, {
        code: '2030',
        label: 'Straordinario 30%',
        quantity: overtime30Hours,
        unitValue: options.overtime30HourlyAmount,
        amount: round2(overtime30Hours * options.overtime30HourlyAmount),
        section: 'overtime',
        type: 'earning',
        linkedPayrollCode: '2030',
        linkedRuleId: 'rule_overtime_manual_authorized',
        confidence: 60,
      });
    }
  }

  if (overtime50Hours > 0) {
    if (options?.overtime50HourlyAmount === undefined) {
      requiresManualInputs.push('Importo orario straordinario/maggiorazione 50 autorizzato.');
    } else {
      pushLine(predictedLines, {
        code: '2250',
        label: 'Maggiorazione 50%',
        quantity: overtime50Hours,
        unitValue: options.overtime50HourlyAmount,
        amount: round2(overtime50Hours * options.overtime50HourlyAmount),
        section: 'overtime',
        type: 'earning',
        linkedPayrollCode: '2250',
        linkedRuleId: 'rule_overtime_manual_authorized',
        confidence: 60,
      });
    }
  }

  if (companyProfile.pdrMode === 'nonPredictable') {
    requiresManualInputs.push('PDR/premi: non prevedibili automaticamente, inserire manualmente se presenti.');
  }

  if (companyProfile.ebilogMode === 'readFromPayslip') {
    warnings.push('EBILOG non stimato rigidamente: verra letto dalla busta paga reale.');
  }

  if (companyProfile.unionFeeMode === 'notFixed') {
    requiresManualInputs.push('Trattenuta sindacale: dipende dal sindacato o dalla busta reale.');
  }

  warnings.push('Pausa pranzo esclusa dal calcolo in questo step.');
  warnings.push('Discontinuita non pagata in automatico: voce contestata/da verificare.');

  predictedLines.push(...buildManualLines(options));

  const manualLines = options?.manualLines ?? [];
  const manualEarnings = round2(
    manualLines
      .filter((line) => line.type === 'earning')
      .reduce((total, line) => total + Math.max(0, line.amount), 0)
  );
  const manualDeductions = round2(
    manualLines
      .filter((line) => line.type === 'deduction')
      .reduce((total, line) => total + Math.abs(line.amount), 0)
  );

  const totalEarnings = sumAmounts(predictedLines, 'earning');
  const totalDeductions = sumAmounts(predictedLines, 'deduction');
  const estimatedNet = round2(totalEarnings - totalDeductions);
  const uncertaintyPenalty =
    requiresManualInputs.length * 4 + warnings.length * 2 + injuryEvents.length * 10 + sicknessEvents.length * 5;

  return {
    summary: {
      grossAmount: totalEarnings,
      netAmount: estimatedNet,
      totalEarnings,
      totalDeductions,
      workedRealDays: realWorkedEvents.length,
      paidOrdinaryDays: paidOrdinaryEvents.length,
      eligibleTravelDays: travelEvents.length,
      sundaysWorked: sundayEvents.length,
      holidaysWorked: holidayWorkedEvents.length,
      abortDays: abortEvents.length,
      vacationDays: input.vacationDays,
      parHours: input.parHours,
      sicknessDays: sicknessEvents.length,
      injuryDays: injuryEvents.length,
      manualEarnings,
      manualDeductions,
    },
    predictedLines,
    warnings: Array.from(new Set(warnings)),
    requiresManualInputs: Array.from(new Set(requiresManualInputs)),
    confidenceScore: Math.max(10, Math.min(95, 85 - uncertaintyPenalty)),
  };
}
