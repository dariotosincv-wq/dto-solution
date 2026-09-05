import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { PayslipImport } from '@/lib/driverPayrollTypes';
import { AttendancePayrollVerificationReport } from './AttendancePayrollVerificationReport';

let root:Root|undefined;let host:HTMLDivElement|undefined;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
afterEach(()=>{if(root)act(()=>root?.unmount());host?.remove();root=undefined;host=undefined;localStorage.clear();});

describe('report festività Turni Driver',()=>{
  it('mostra 1 contro 1 e Corretto per il 1 maggio 2026 non lavorato',async()=>{
    localStorage.setItem('attendance',JSON.stringify({'2026-05-01':{status:'Festività non lavorata'}}));
    const payslip:PayslipImport={id:'may-2026',year:2026,month:5,importedAt:'',extractionMethod:'pdf_text',detectedFormat:'logisticsLayoutV1',parsedLines:[{code:'3900',label:'Festività',quantity:1,quantityUnit:'days'}],summary:{} as PayslipImport['summary'],warnings:[]};
    host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
    await act(async()=>{root?.render(<AttendancePayrollVerificationReport payslip={payslip}/>);});
    const holidayCard=Array.from(host.querySelectorAll('div.rounded-lg')).find(element=>element.textContent?.includes('Festività')&&element.textContent?.includes('Turni Driver: 1'));
    expect(holidayCard?.textContent).toContain('Corretto');
    expect(holidayCard?.textContent).toContain('Turni Driver: 1 · Busta paga: 1');
  });
});
