import type { MonthlyAttendanceSummary } from './monthlyAttendanceSummary';
import type { PayslipImport, PayslipLine, PayslipQuantityUnit } from './driverPayrollTypes';
import { getPayslipLineQuantity, getPayslipLineSemanticValues } from './driverPayrollLineValues';

export type VerificationStatus = 'OK' | 'WARNING' | 'NOT_VERIFIABLE' | 'INFO';
export type VerificationMetricKey = 'workedDays'|'vacationDays'|'permit'|'sickness'|'injury'|'holidays'|'travelDays'|'sundayDays'|'ordinaryHours'|'overtimeHours';
export interface PayrollMetric { value:number; unit:PayslipQuantityUnit; sourceCodes:string[] }
export interface PayrollVerificationData {
  year:number; month:number;
  metrics:Partial<Record<VerificationMetricKey,PayrollMetric>>;
  supportedWhenAbsent:VerificationMetricKey[];
  unavailableReasons:Partial<Record<VerificationMetricKey,string>>;
}
export interface AttendancePayrollCheck { key:string; label:string; attendanceValue?:number; payrollValue?:number; attendanceUnit?:string; payrollUnit?:string; status:VerificationStatus; message:string }
export interface PayrollAttendanceVerificationReport { year:number; month:number; periodMatches:boolean; hasAttendance:boolean; isAttendancePartial:boolean; checks:AttendancePayrollCheck[]; totals:Record<VerificationStatus,number> }

const codeGroups:Record<VerificationMetricKey,string[]>={
  workedDays:['0170'],vacationDays:['5000'],permit:['5050'],sickness:['1981','2500','2520','2530','2600'],
  injury:['1989','2700','2720','2800'],holidays:['3900','3901'],travelDays:['2310'],sundayDays:['2315'],
  ordinaryHours:['0169','0785'],overtimeHours:['2030','2014'],
};
const attendanceCategories:VerificationMetricKey[]=['workedDays','vacationDays','permit','sickness','injury','holidays','travelDays','sundayDays'];
const extract=(lines:PayslipLine[],key:VerificationMetricKey):{metric?:PayrollMetric;reason?:string}=>{
  const matches=lines.filter(line=>line.code&&codeGroups[key].includes(line.code)&&(line.confidence??100)>=70&&getPayslipLineQuantity(line)!==undefined);
  if(!matches.length)return{};
  const units=[...new Set(matches.map(line=>getPayslipLineSemanticValues(line).quantityUnit))];
  if(units.length!==1)return{reason:'Il cedolino contiene unitÃ  non omogenee.'};
  if((key==='sickness'||key==='injury'||key==='holidays')&&matches.length>1)return{reason:'PiÃ¹ voci aggregate non consentono un conteggio certo.'};
  return{metric:{value:matches.reduce((sum,line)=>sum+(getPayslipLineQuantity(line)??0),0),unit:units[0],sourceCodes:matches.map(line=>line.code!)}};
};
export const adaptPayslipForAttendanceVerification=(payslip:PayslipImport):PayrollVerificationData=>{
  const recognizedLayout=payslip.detectedFormat==='logisticsLayoutV1'||payslip.parserUsed==='parseLogisticsLayoutV1Payslip';
  const result:PayrollVerificationData={year:payslip.year,month:payslip.month,metrics:{},supportedWhenAbsent:recognizedLayout?[...attendanceCategories]:[],unavailableReasons:{}};
  (Object.keys(codeGroups)as VerificationMetricKey[]).forEach(key=>{const found=extract(payslip.parsedLines,key);if(found.metric)result.metrics[key]=found.metric;else if(found.reason)result.unavailableReasons[key]=found.reason;else if(!result.supportedWhenAbsent.includes(key))result.unavailableReasons[key]='Categoria non verificabile con il formato riconosciuto.';});
  return result;
};

export const compareAttendanceWithPayroll=(summary:MonthlyAttendanceSummary,payroll:PayrollVerificationData):PayrollAttendanceVerificationReport=>{
  const periodMatches=summary.year===payroll.year&&summary.month===payroll.month;
  const checks:AttendancePayrollCheck[]=[];
  const addDirect=(key:VerificationMetricKey,label:string,value:number,differenceMessage?:string)=>{
    const extracted=payroll.metrics[key];
    const metric=extracted??(payroll.supportedWhenAbsent.includes(key)?{value:0,unit:'days' as const,sourceCodes:[]}:undefined);
    if(!metric||metric.unit!=='days'){
      checks.push({key,label,attendanceValue:value,attendanceUnit:'days',payrollValue:metric?.value,payrollUnit:metric?.unit,status:'NOT_VERIFIABLE',message:metric?'Il cedolino usa unâ€™unitÃ  incompatibile con i giorni registrati.':'Non verificabile con i dati disponibili nel cedolino.'});return;
    }
    const ok=value===metric.value;
    checks.push({key,label,attendanceValue:value,payrollValue:metric.value,attendanceUnit:'days',payrollUnit:'days',status:ok?'OK':'WARNING',message:ok?'Nessuna differenza rilevata.':differenceMessage??`Turni Driver: ${value}. Busta paga: ${metric.value}. Controlla i turni registrati e, se sono corretti, verifica il cedolino.`});
  };
  if(!periodMatches)checks.push({key:'period',label:'Periodo',status:'INFO',message:'Mese o anno non corrispondenti: confronto non eseguito.'});
  else if(summary.registeredDays===0)checks.push({key:'attendance',label:'Turni Driver',status:'INFO',message:'Non risultano Turni Driver registrati per questo mese.'});
  else{
    addDirect('workedDays','Giorni lavorati',summary.workedDays);
    addDirect('vacationDays','Ferie',summary.vacationDays);
    addDirect('sickness','Malattia',summary.sickDays);
    addDirect('injury','Infortunio',summary.injuryDays);
    addDirect('permit','Permessi',summary.permitDays);
    addDirect('sundayDays','Domeniche lavorate',summary.sundayWorkedDays);
    addDirect('holidays','Festività',summary.totalHolidayDays,'È stata rilevata una differenza. Controlla i Turni Driver e, se sono corretti, verifica il cedolino.');
    const extracted=payroll.metrics.travelDays;
    const travel=extracted??(payroll.supportedWhenAbsent.includes('travelDays')?{value:0,unit:'days' as const,sourceCodes:[]}:undefined);
    if(!travel||travel.unit!=='days')checks.push({key:'travelDays',label:'Trasferte',attendanceValue:summary.potentialTravelDays,payrollValue:travel?.value,status:'NOT_VERIFIABLE',message:'Non verificabile con i dati disponibili nel cedolino.'});
    else if(travel.value===summary.potentialTravelDays)checks.push({key:'travelDays',label:'Trasferte',attendanceValue:summary.potentialTravelDays,payrollValue:travel.value,status:'OK',message:'Trasferte coerenti con le giornate lavorate.'});
    else if(travel.value>summary.potentialTravelDays)checks.push({key:'travelDays',label:'Trasferte',attendanceValue:summary.potentialTravelDays,payrollValue:travel.value,status:'INFO',message:`Turni Driver: ${summary.potentialTravelDays} giornate teoricamente valide. Busta paga: ${travel.value} trasferte. La differenza puÃ² dipendere da una regola aziendale favorevole.`});
    else checks.push({key:'travelDays',label:'Trasferte',attendanceValue:summary.potentialTravelDays,payrollValue:travel.value,status:'WARNING',message:`Nei Turni Driver risultano ${summary.potentialTravelDays} giornate potenzialmente valide per la trasferta, mentre il cedolino ne riporta ${travel.value}.`});
    if(summary.unfilledHolidayDays>0)checks.push({key:'unfilled-holidays',label:'Festività non compilate',attendanceValue:summary.unfilledHolidayDays,status:'INFO',message:`${summary.unfilledHolidayDays} festività di calendario non risultano compilate nei Turni Driver. Non sono state confrontate con il cedolino.`});
  }
  const totals={OK:0,WARNING:0,NOT_VERIFIABLE:0,INFO:0};checks.forEach(check=>totals[check.status]++);
  return{year:payroll.year,month:payroll.month,periodMatches,hasAttendance:summary.registeredDays>0,isAttendancePartial:summary.isPartial,checks,totals};
};
