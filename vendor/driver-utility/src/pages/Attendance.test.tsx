import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Attendance from './Attendance';

vi.mock('@capacitor/preferences',()=>({Preferences:{get:vi.fn().mockResolvedValue({value:null}),set:vi.fn().mockResolvedValue(undefined)}}));
let root:Root|undefined; let host:HTMLDivElement|undefined;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date(2026,3,1,12));});
afterEach(()=>{if(root)act(()=>root?.unmount());host?.remove();root=undefined;host=undefined;vi.useRealTimers();localStorage.clear();});
const renderPage=async()=>{host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);await act(async()=>{root?.render(<MemoryRouter><Attendance/></MemoryRouter>);await Promise.resolve();});};

describe('Turni Driver e festività',()=>{
  it('evidenzia Pasquetta senza salvarla e propone lo stato solo sul giorno festivo',async()=>{
    await renderPage();
    expect(host!.textContent).toContain('Lunedì dell’Angelo');expect(localStorage.getItem('attendance')).toBe(JSON.stringify({}));
    const holidayButton=Array.from(host!.querySelectorAll('button')).find(button=>button.textContent?.includes('Lunedì dell’Angelo'));
    await act(async()=>holidayButton?.click());expect(host!.textContent).toContain('Festività non lavorata');
    const normalDayButton=Array.from(host!.querySelectorAll('button')).find(button=>button.textContent?.includes('7')&&button.textContent?.toLowerCase().includes('mar'));
    await act(async()=>normalDayButton?.click());expect(host!.textContent).not.toContain('Festività non lavorata');
  });
  it('non mostra Giorno non contrattuale il 2 giugno a un full-time salvato',async()=>{
    vi.setSystemTime(new Date(2026,5,1,12));
    localStorage.setItem('driverContractProfile',JSON.stringify({contractType:'full_time',weeklyHours:40,contractualWeekdays:[1,2,3,4,5]}));
    await renderPage();expect(host!.textContent).toContain('Festa della Repubblica');expect(host!.textContent).not.toContain('Giorno non contrattuale');
  });
  it('propone il nuovo stato Lavorato sotto 4 ore',async()=>{
    await renderPage();const dayButton=Array.from(host!.querySelectorAll('button')).find(button=>button.textContent?.includes('7')&&button.textContent?.toLowerCase().includes('mar'));
    await act(async()=>dayButton?.click());expect(host!.textContent).toContain('Lavorato < 4 ore');
  });
});
