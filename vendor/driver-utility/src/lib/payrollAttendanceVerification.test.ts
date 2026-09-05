import { describe, expect, it } from 'vitest';
import type { PayslipImport } from './driverPayrollTypes';
import { adaptPayslipForAttendanceVerification, compareAttendanceWithPayroll } from './payrollAttendanceVerification';
import type { MonthlyAttendanceSummary } from './monthlyAttendanceSummary';

const payslip=(month=5,year=2026):PayslipImport=>({id:'p',year,month,importedAt:'',extractionMethod:'pdf_text',detectedFormat:'logisticsLayoutV1',parsedLines:[
  {code:'0170',label:'giorni lavorati',quantity:21,quantityUnit:'days'}, {code:'5000',label:'ferie',quantity:2,quantityUnit:'days'},
  {code:'5050',label:'permessi',quantity:8,quantityUnit:'hours'}, {code:'2310',label:'trasferte',quantity:20,quantityUnit:'days'},
],summary:{} as PayslipImport['summary'],warnings:[]});
const summary=(month=5,year=2026):MonthlyAttendanceSummary=>({year,month,daysInMonth:31,registeredDays:24,unfilledDays:7,workedDays:21,vacationDays:2,permitDays:1,sickDays:0,injuryDays:0,restDays:0,abortedRouteDays:0,medicalVisitDays:0,holidayWorkedDays:0,holidayNotWorkedDays:0,totalHolidayDays:0,sundayWorkedDays:0,potentialTravelDays:21,shortWorkedDays:0,unfilledHolidayDays:0,workedDates:[],isPartial:true});

describe('controllo Turni Driver e cedolino',()=>{
  it('segnala corrispondenze, differenze e unitÃ  incompatibili senza stime',()=>{
    const report=compareAttendanceWithPayroll(summary(),adaptPayslipForAttendanceVerification(payslip()));
    expect(report.checks.find(c=>c.key==='workedDays')?.status).toBe('OK');
    expect(report.checks.find(c=>c.key==='vacationDays')?.status).toBe('OK');
    expect(report.checks.find(c=>c.key==='permit')?.status).toBe('NOT_VERIFIABLE');
    expect(report.checks.find(c=>c.key==='travelDays')?.status).toBe('WARNING');
  });
  it.each([[4,2026],[5,2025]])('non confronta un periodo diverso', (month,year)=>{
    const report=compareAttendanceWithPayroll(summary(),adaptPayslipForAttendanceVerification(payslip(month,year)));
    expect(report.periodMatches).toBe(false); expect(report.checks).toHaveLength(1);
  });
  it('gestisce nessun turno e nessuna voce payroll',()=>{
    const empty={...summary(),registeredDays:0,unfilledDays:31,workedDays:0};
    const blank={...payslip(),parsedLines:[]};
    const report=compareAttendanceWithPayroll(empty,adaptPayslipForAttendanceVerification(blank));
    expect(report.hasAttendance).toBe(false); expect(report.checks[0].status).toBe('INFO');
  });
  it.each([['injury'],['permit'],['sundayDays']])('considera zero una voce assente ma supportata: %s',(key)=>{
    const report=compareAttendanceWithPayroll({...summary(),permitDays:0},adaptPayslipForAttendanceVerification({...payslip(),parsedLines:[]}));
    expect(report.checks.find(item=>item.key===key)).toMatchObject({attendanceValue:0,payrollValue:0,status:'OK'});
  });
  it('non trasforma in zero una categoria assente su formato non supportato',()=>{
    const blank={...payslip(),detectedFormat:'generic' as const,parsedLines:[]};
    expect(compareAttendanceWithPayroll(summary(),adaptPayslipForAttendanceVerification(blank)).checks.find(c=>c.key==='injury')?.status).toBe('NOT_VERIFIABLE');
  });
  it('confronta la festivitÃ  aggregata con lavorate piÃ¹ non lavorate',()=>{
    const parsedLines=[{code:'3900',label:'festivitÃ ',quantity:1,quantityUnit:'days' as const}];
    const report=compareAttendanceWithPayroll({...summary(),holidayNotWorkedDays:1,totalHolidayDays:1},adaptPayslipForAttendanceVerification({...payslip(),parsedLines}));
    expect(report.checks.find(c=>c.key==='holidays')?.status).toBe('OK');
  });
  it('non ripete i valori nel warning festività',()=>{
    const parsedLines=[{code:'3900',label:'festività',quantity:1,quantityUnit:'days' as const}];
    const check=compareAttendanceWithPayroll(summary(),adaptPayslipForAttendanceVerification({...payslip(),parsedLines})).checks.find(c=>c.key==='holidays');
    expect(check).toMatchObject({attendanceValue:0,payrollValue:1,status:'WARNING'});
    expect(check?.message).not.toContain('Turni Driver: 0'); expect(check?.message).not.toContain('Busta paga: 1');
  });
  it('confronta due festività aggregate come coerenti',()=>{
    const parsedLines=[{code:'3900',label:'festività',quantity:2,quantityUnit:'days' as const}];
    const check=compareAttendanceWithPayroll({...summary(),holidayWorkedDays:1,holidayNotWorkedDays:1,totalHolidayDays:2},adaptPayslipForAttendanceVerification({...payslip(),parsedLines})).checks.find(c=>c.key==='holidays');
    expect(check).toMatchObject({attendanceValue:2,payrollValue:2,status:'OK'});
  });
  it.each([[19,19,'OK'],[19,18,'WARNING'],[18,18,'OK'],[18,19,'INFO']] as const)('valuta trasferte %i vs %i come %s',(eligible,payrollDays,status)=>{
    const parsedLines=[{code:'2310',label:'trasferte',quantity:payrollDays,quantityUnit:'days' as const}];
    const report=compareAttendanceWithPayroll({...summary(),potentialTravelDays:eligible,workedDays:19,shortWorkedDays:19-eligible},adaptPayslipForAttendanceVerification({...payslip(),parsedLines}));
    expect(report.checks.find(c=>c.key==='travelDays')?.status).toBe(status);
  });
});
