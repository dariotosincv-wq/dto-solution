import { describe, expect, it } from 'vitest';
import { summarizeMonthlyAttendance } from './monthlyAttendanceSummary';
import { normalizeDriverContractProfile } from './driverContractProfile';

describe('summarizeMonthlyAttendance',()=>{
  it('deriva gli stati, le festivitÃ  e lascia vuoti i giorni non compilati',()=>{
    const attendance={
      '2026-06-01':{status:'Ferie'}, '2026-06-02':{status:'Lavorato'}, '2026-06-03':{status:'Permesso'},
      '2026-06-04':{status:'Malattia'}, '2026-06-05':{status:'Infortunio'}, '2026-06-06':{status:'Riposo'},
      '2026-06-07':{status:'Lavorato'}, '2026-06-08':{status:'Rotta abortita'}, '2026-06-09':{status:'Visita medica'},
      '2026-06-10':{status:'Festività non lavorata'},
    };
    const result=summarizeMonthlyAttendance(attendance,2026,6,normalizeDriverContractProfile({contractType:'full_time',weeklyHours:40}));
    expect(result).toMatchObject({workedDays:2,vacationDays:1,permitDays:1,sickDays:1,injuryDays:1,restDays:1,abortedRouteDays:1,medicalVisitDays:1,holidayWorkedDays:1,holidayNotWorkedDays:1,totalHolidayDays:2,sundayWorkedDays:1,registeredDays:10,unfilledDays:20,isPartial:true});
    expect(attendance['2026-06-01'].status).toBe('Ferie');
  });
  it('calcola i giorni contrattuali solo per il part-time',()=>{
    const full=summarizeMonthlyAttendance({},2026,6,normalizeDriverContractProfile({contractType:'full_time',weeklyHours:40}));
    const part=summarizeMonthlyAttendance({},2026,6,normalizeDriverContractProfile({contractType:'part_time',weeklyHours:32,contractualWeekdays:[1,2,4,5]}));
    expect(full.contractualDays).toBeUndefined();
    expect((part.contractualDays??0)+(part.nonContractualDays??0)).toBe(30);
  });
  it('conta Lavorato sotto 4 ore come lavorato ma non come trasferta',()=>{
    const result=summarizeMonthlyAttendance({'2026-06-01':{status:'Lavorato'},'2026-06-02':{status:'Lavorato < 4 ore'}},2026,6,normalizeDriverContractProfile({contractType:'full_time',weeklyHours:40}));
    expect(result).toMatchObject({workedDays:2,potentialTravelDays:1,shortWorkedDays:1});
  });
  it('segnala una festivitÃ  non compilata senza assegnarle uno stato',()=>{
    const result=summarizeMonthlyAttendance({},2026,6,normalizeDriverContractProfile({contractType:'full_time',weeklyHours:40}));
    expect(result.unfilledHolidayDays).toBe(1);
    expect(result.holidayWorkedDays+result.holidayNotWorkedDays).toBe(0);
    expect(result.totalHolidayDays).toBe(0);
  });
  it('conta il 1 maggio 2026 impostato come festività non lavorata',()=>{
    const result=summarizeMonthlyAttendance({'2026-05-01':{status:'Festività non lavorata'}},2026,5,normalizeDriverContractProfile({contractType:'full_time',weeklyHours:40}));
    expect(result).toMatchObject({holidayWorkedDays:0,holidayNotWorkedDays:1,totalHolidayDays:1});
  });
  it('conta il 1 maggio lavorato come festività lavorata',()=>{
    const result=summarizeMonthlyAttendance({'2026-05-01':{status:'Lavorato'}},2026,5,normalizeDriverContractProfile({contractType:'full_time',weeklyHours:40}));
    expect(result).toMatchObject({holidayWorkedDays:1,holidayNotWorkedDays:0,totalHolidayDays:1});
  });
  it.each([['Festivo pagato','holidayNotWorkedDays'],['Festivo lavorato','holidayWorkedDays'],['Festività lavorata','holidayWorkedDays']] as const)('mantiene lo stato legacy %s',(status,field)=>{
    const result=summarizeMonthlyAttendance({'2026-05-01':{status}},2026,5,normalizeDriverContractProfile({contractType:'full_time',weeklyHours:40}));
    expect(result[field]).toBe(1); expect(result.totalHolidayDays).toBe(1);
  });
  it('somma una festività lavorata e una non lavorata',()=>{
    const result=summarizeMonthlyAttendance({'2026-12-25':{status:'Lavorato'},'2026-12-26':{status:'Festività non lavorata'}},2026,12,normalizeDriverContractProfile({contractType:'full_time',weeklyHours:40}));
    expect(result).toMatchObject({holidayWorkedDays:1,holidayNotWorkedDays:1,totalHolidayDays:2});
  });
});
