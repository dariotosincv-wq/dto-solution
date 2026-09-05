import { BriefcaseBusiness, CalendarDays, ChevronRight, ReceiptText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';

const DriverWorkPage = () => {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <PageHeader
        title="Turni e Busta Paga"
        subtitle="Lavoro, turni e documenti"
        theme="payroll"
        icon={BriefcaseBusiness}
        backTo="/"
      />

      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => navigate('/turni-driver')}
          className="driver-card flex min-h-[96px] items-center gap-4 text-left"
        >
          <div className="shrink-0 rounded-2xl bg-amber-100 p-3 dark:bg-amber-950">
            <CalendarDays className="h-7 w-7 text-orange-700 dark:text-orange-300" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold text-foreground">Turni Driver</p>
            <p className="mt-1 text-sm text-muted-foreground">Gestione turni</p>
          </div>

          <ChevronRight className="h-6 w-6 shrink-0 text-muted-foreground" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/driver-payroll')}
          className="driver-card flex min-h-[96px] items-center gap-4 text-left"
        >
          <div className="shrink-0 rounded-2xl bg-emerald-100 p-3 dark:bg-emerald-950">
            <ReceiptText className="h-7 w-7 text-emerald-700 dark:text-emerald-300" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold text-foreground">Busta Paga Driver</p>
            <p className="mt-1 text-sm text-muted-foreground">Controlla, archivia e analizza</p>
          </div>

          <ChevronRight className="h-6 w-6 shrink-0 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

export default DriverWorkPage;
