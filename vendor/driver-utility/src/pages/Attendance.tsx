import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { generateAttendancePDF } from '@/lib/pdfGenerator';
import { exportAttendancePdf } from '@/lib/attendancePdfExport';
import {
  DEFAULT_DRIVER_CONTRACT_PROFILE,
  DRIVER_CONTRACT_PROFILE_STORAGE_KEY,
  isContractualWeekday,
  normalizeDriverContractProfile,
  type DriverContractProfile,
} from '@/lib/driverContractProfile';
import { getItalianHoliday } from '@/lib/italianHolidays';
import { toast } from 'sonner';
import {
  FileDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Briefcase,
  Palmtree,
  Clock,
  Thermometer,
  AlertTriangle,
} from 'lucide-react';

const statuses = [
  'Lavorato',
  'Lavorato < 4 ore',
  'Ferie',
  'Permesso',
  'Malattia',
  'Infortunio',
  'Riposo',
  'Rotta abortita',
  'Visita medica',
  'Festività non lavorata',
] as const;

const statusColors: Record<string, string> = {
  Lavorato: 'bg-accent text-accent-foreground',
  'Lavorato < 4 ore': 'bg-accent/70 text-accent-foreground',
  Ferie: 'bg-warning text-warning-foreground',
  Permesso: 'bg-info text-info-foreground',
  Malattia: 'bg-destructive text-destructive-foreground',
  Infortunio: 'bg-destructive text-destructive-foreground',
  Riposo: 'bg-secondary text-secondary-foreground',
  'Rotta abortita': 'bg-destructive/70 text-destructive-foreground',
  'Visita medica': 'bg-info/70 text-info-foreground',
  'Festività non lavorata': 'bg-amber-500 text-white',
};

const statusIcons: Record<string, typeof Briefcase> = {
  Lavorato: Briefcase,
  'Lavorato < 4 ore': Briefcase,
  Ferie: Palmtree,
  Permesso: Clock,
  Malattia: Thermometer,
  Infortunio: AlertTriangle,
};

const monthNames = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const Attendance = () => {
  const [attendance, setAttendance] = useLocalStorage<
    Record<string, { status: string; notes?: string }>
  >('attendance', {});
  const [storedContractProfile] = useLocalStorage<DriverContractProfile>(
    DRIVER_CONTRACT_PROFILE_STORAGE_KEY,
    DEFAULT_DRIVER_CONTRACT_PROFILE,
  );
  const contractProfile = useMemo(
    () => normalizeDriverContractProfile(storedContractProfile),
    [storedContractProfile],
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const today = new Date();
  const todayStr = formatLocalDate(today);
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(viewYear, viewMonth, i + 1);
    return formatLocalDate(d);
  });

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    statuses.forEach((s) => {
      t[s] = 0;
    });

    days.forEach((d) => {
      const s = attendance[d]?.status;
      if (s && t[s] !== undefined) t[s]++;
    });

    return t;
  }, [attendance, days]);

  const totalRegistered = Object.values(totals).reduce((a, b) => a + b, 0);

  const handleSetStatus = (day: string, status: string) => {
    setAttendance((prev) => ({
      ...prev,
      [day]: { ...prev[day], status },
    }));
  };

  const handleExport = async () => {
    const pdf = generateAttendancePDF({
      month: monthNames[viewMonth],
      year: String(viewYear),
      days: days.map((d) => ({
        date: d,
        status: attendance[d]?.status || '-',
        notes: attendance[d]?.notes,
        holidayName: getItalianHoliday(parseLocalDate(d))?.name,
      })),
      totals,
    });

    try {
      const mode = await exportAttendancePdf(pdf, `presenze-${monthNames[viewMonth]}-${viewYear}.pdf`);
      toast.success(mode === 'shared' ? 'PDF pronto per essere condiviso' : 'PDF scaricato');
    } catch (error) {
      console.error('Esportazione PDF Turni Driver fallita', error);
      toast.error('Impossibile esportare il PDF. Riprova.');
    }
  };

  const handleReset = () => {
    setAttendance((prev) => {
      const next = { ...prev };
      days.forEach((d) => delete next[d]);
      return next;
    });
    setShowResetConfirm(false);
    toast.success(`Presenze di ${monthNames[viewMonth]} azzerate`);
  };

  const quickStats = [
    {
      label: 'Lavorati',
      value: totals['Lavorato'] + totals['Lavorato < 4 ore'],
      icon: Briefcase,
      color: 'text-accent',
    },
    {
      label: 'Ferie',
      value: totals['Ferie'],
      icon: Palmtree,
      color: 'text-warning',
    },
    {
      label: 'Permessi',
      value: totals['Permesso'],
      icon: Clock,
      color: 'text-info',
    },
    {
      label: 'Malattia',
      value: totals['Malattia'],
      icon: Thermometer,
      color: 'text-destructive',
    },
    {
      label: 'Infortunio',
      value: totals['Infortunio'],
      icon: AlertTriangle,
      color: 'text-destructive',
    },
  ];

  return (
    <div className="page-container">
      <PageHeader title="Turni Driver" subtitle="Gestione turni" theme="payroll" icon={Briefcase} backTo="/turni-e-busta-paga" />

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => {
            if (viewMonth === 0) {
              setViewMonth(11);
              setViewYear((y) => y - 1);
            } else {
              setViewMonth((m) => m - 1);
            }
          }}
          className="p-2.5 rounded-xl bg-card border border-border active:scale-95 touch-manipulation"
        >
          <ChevronLeft size={20} />
        </button>

        <h2 className="font-bold text-lg text-foreground">
          {monthNames[viewMonth]} {viewYear}
        </h2>

        <button
          onClick={() => {
            if (viewMonth === 11) {
              setViewMonth(0);
              setViewYear((y) => y + 1);
            } else {
              setViewMonth((m) => m + 1);
            }
          }}
          className="p-2.5 rounded-xl bg-card border border-border active:scale-95 touch-manipulation"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-5">
        {quickStats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-card border border-border rounded-xl p-2 flex flex-col items-center gap-1"
          >
            <Icon size={16} className={color} />
            <span className="text-lg font-bold text-foreground">{value}</span>
            <span className="text-[10px] text-muted-foreground leading-tight text-center">
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-1.5 mb-6">
        {days.map((day) => {
          const dayDate = parseLocalDate(day);
          const dayNum = dayDate.getDate();
          const weekday = dayDate.toLocaleDateString('it-IT', {
            weekday: 'short',
          });
          const entry = attendance[day];
          const isSelected = selectedDay === day;
          const isToday = day === todayStr;
          const isSunday = dayDate.getDay() === 0;
          const holiday = getItalianHoliday(dayDate);
          const contractualDay = isContractualWeekday(dayDate, contractProfile);
          const availableStatuses = holiday
            ? statuses
            : statuses.filter((status) => status !== 'Festività non lavorata');

          return (
            <div key={day}>
              <button
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`w-full flex items-center justify-between py-3 px-3 rounded-xl border transition-all touch-manipulation
                  ${isSelected ? 'ring-2 ring-ring bg-card border-ring' : 'bg-card border-border'}
                  ${isToday ? 'border-primary/50 shadow-sm' : ''}
                  active:scale-[0.98]`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold
                    ${
                      isToday
                        ? 'bg-primary text-primary-foreground'
                        : holiday
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : isSunday
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-muted text-foreground'
                    }`}
                  >
                    {dayNum}
                  </div>
                  <span
                    className={`text-sm capitalize ${isSunday ? 'text-destructive' : 'text-muted-foreground'}`}
                  >
                    {weekday}
                  </span>
                  {holiday && (
                    <span className="text-left text-[10px] font-semibold leading-tight text-amber-700 dark:text-amber-300">
                      {holiday.name}
                      {!contractualDay && <span className="block font-normal">Giorno non contrattuale</span>}
                    </span>
                  )}
                </div>

                {entry?.status ? (
                  <span className={`status-badge text-xs ${statusColors[entry.status]}`}>
                    {entry.status}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/50">—</span>
                )}
              </button>

              {isSelected && (
                <div className="bg-card border border-t-0 border-border rounded-b-xl p-3 -mt-1 space-y-2">
                  <div className="grid grid-cols-4 gap-1.5">
                    {availableStatuses.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSetStatus(day, s)}
                        className={`py-2 px-1 rounded-lg text-[11px] font-medium transition-all touch-manipulation active:scale-95 ${
                          entry?.status === s
                            ? statusColors[s]
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <input
                    className="driver-input text-sm"
                    placeholder="Note (opzionale)..."
                    value={entry?.notes || ''}
                    onChange={(e) =>
                      setAttendance((prev) => ({
                        ...prev,
                        [day]: {
                          ...prev[day],
                          status: prev[day]?.status || '',
                          notes: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <h3 className="font-semibold text-sm text-foreground mb-3">
          Riepilogo {monthNames[viewMonth]}
        </h3>

        <div className="grid grid-cols-2 gap-2 text-sm">
          {statuses.map(
            (s) =>
              totals[s] > 0 && (
                <div key={s} className="flex justify-between">
                  <span className="text-muted-foreground">{s}</span>
                  <span className="font-semibold text-foreground">{totals[s]}</span>
                </div>
              )
          )}
        </div>

        <div className="border-t border-border mt-3 pt-3 flex justify-between text-sm">
          <span className="text-muted-foreground">Registrati / Totale</span>
          <span className="font-bold text-foreground">
            {totalRegistered} / {daysInMonth}
          </span>
        </div>
      </div>

      <div className="space-y-3 pb-4">
        <button onClick={handleExport} className="driver-btn-primary w-full">
          <FileDown size={20} /> Esporta PDF Turni Driver
        </button>

        <button
          onClick={() => setShowResetConfirm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-destructive/30 text-destructive bg-destructive/5 font-medium touch-manipulation active:scale-[0.98] transition-transform"
        >
          <RotateCcw size={18} /> Reset mese
        </button>
      </div>

      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-lg border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-foreground mb-2">Reset turni</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Vuoi davvero azzerare i turni di <strong>{monthNames[viewMonth]}</strong>?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground font-medium touch-manipulation"
              >
                Annulla
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-3 rounded-xl bg-destructive text-destructive-foreground font-medium touch-manipulation"
              >
                Azzera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
