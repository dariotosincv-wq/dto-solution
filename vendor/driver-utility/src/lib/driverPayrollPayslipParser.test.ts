import { describe, expect, it } from 'vitest';
import { parsePayrollLayoutV1Text, stripPayslipTemporaryData } from './driverPayrollPayslipParser';

const baseText = `
COMPANY LOGISTICS SRL
PERIODO PAGA GENNAIO 2026
LIVELLO G1
SEDE/COSTO DL05 - HUB LOGISTICO
1000 RETRIBUZIONE/STIPENDIO * * 87,38 22,00 1.922,36
`;

describe('driverPayrollPayslipParser', () => {
  it('riconosce trasferta 22,50 x 17 = 382,50', () => {
    const payslip = parsePayrollLayoutV1Text(`${baseText}\n2310 TRASFERTA 22,50 17,00 382,50`);
    const line = payslip.parsedLines.find((item) => item.code === '2310');

    expect(line).toMatchObject({
      label: 'TRASFERTA',
      unitValue: 22.5,
      quantity: 17,
      amount: 382.5,
      linkedPayrollCode: '2310',
    });
  });

  it('riconosce indennita domenicale 7,00 x 2 = 14,00', () => {
    const payslip = parsePayrollLayoutV1Text(`${baseText}\n2315 INDENNITA LAVORO DOMENICALE 7,00 2,00 14,00`);
    const line = payslip.parsedLines.find((item) => item.code === '2315');

    expect(line).toMatchObject({
      unitValue: 7,
      quantity: 2,
      amount: 14,
      linkedPayrollCode: '2315',
    });
  });

  it('riconosce netto da una riga finale BONIFICO e periodo', () => {
    const payslip = parsePayrollLayoutV1Text(`${baseText}\nTOTALE COMPETENZE 2.318,86\nTOTALE TRATTENUTE 512,34\nBONIFICO 10/02/2026 1.806,52`);

    expect(payslip.month).toBe(1);
    expect(payslip.year).toBe(2026);
    expect(payslip.payrollPeriodLabel).toBe('GENNAIO 2026');
    expect(payslip.summary.netAmount).toBe(1806.52);
    expect(payslip.summary.paymentDate).toBe('2026-02-10');
  });

  it('riconosce malattia con codici 1981, 2500, 2520, 2600, 2650', () => {
    const payslip = parsePayrollLayoutV1Text(`
${baseText}
1981 ORE MALATTIA 8,00
2500 MALATTIA CARENZA 100% 8,00 12,50 100,00
2520 MALATTIA INPS 50% 16,00 5,00 80,00
2600 INTEGRAZIONE MALATTIA AZIENDA 16,00 3,00 48,00
2650 TRATTENUTA ASSENZA MALATTIA 24,00 10,00 240,00
`);

    expect(payslip.parsedLines.map((line) => line.code)).toEqual(
      expect.arrayContaining(['1981', '2500', '2520', '2600', '2650'])
    );
    expect(payslip.parsedLines.find((line) => line.code === '1981')?.section).toBe('sickness');
    expect(payslip.parsedLines.find((line) => line.code === '2650')?.type).toBe('deduction');
  });

  it('non salva rawText come campo persistente', () => {
    const payslip = parsePayrollLayoutV1Text(baseText);
    const persistable = stripPayslipTemporaryData(payslip);

    expect(payslip.rawTextTemporary).toContain('COMPANY LOGISTICS SRL');
    expect('rawTextTemporary' in persistable).toBe(false);
  });
});
