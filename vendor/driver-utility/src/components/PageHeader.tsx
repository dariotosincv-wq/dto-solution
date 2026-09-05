import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export type SectionTheme = 'qr' | 'checkvan' | 'payroll' | 'dailyPhotos' | 'neutral';

const sectionThemes: Record<SectionTheme, {
  accent: string;
  surface: string;
  border: string;
  iconSurface: string;
}> = {
  qr: {
    accent: 'bg-[#0a4db3]',
    surface: 'bg-[#0a4db3]/[0.07] dark:bg-[#0a4db3]/20',
    border: 'border-[#0a4db3]/25 dark:border-sky-400/25',
    iconSurface: 'bg-[#0a4db3] text-white',
  },
  checkvan: {
    accent: 'bg-[#0f766e]',
    surface: 'bg-[#0f766e]/[0.07] dark:bg-[#0f766e]/20',
    border: 'border-[#0f766e]/25 dark:border-teal-300/25',
    iconSurface: 'bg-[#0f766e] text-white',
  },
  payroll: {
    accent: 'bg-[#6f2232]',
    surface: 'bg-[#6f2232]/[0.07] dark:bg-[#6f2232]/25',
    border: 'border-[#6f2232]/25 dark:border-rose-300/25',
    iconSurface: 'bg-[#6f2232] text-white',
  },
  dailyPhotos: {
    accent: 'bg-[#c88716]',
    surface: 'bg-[#c88716]/[0.09] dark:bg-[#c88716]/20',
    border: 'border-[#c88716]/30 dark:border-amber-300/25',
    iconSurface: 'bg-[#9a620c] text-white',
  },
  neutral: {
    accent: 'bg-primary',
    surface: 'bg-primary/[0.06]',
    border: 'border-primary/20',
    iconSurface: 'bg-primary text-primary-foreground',
  },
};

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  theme?: SectionTheme;
  icon?: LucideIcon;
  backTo?: string;
}

export const PageHeader = ({
  title,
  subtitle,
  theme = 'neutral',
  icon: Icon,
  backTo,
}: PageHeaderProps) => {
  const navigate = useNavigate();
  const colors = sectionThemes[theme];

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
      return;
    }
    navigate(-1);
  };

  return (
    <header
      className={`relative mb-5 flex min-h-[78px] w-full items-center gap-3 overflow-hidden rounded-2xl border px-3 py-3 ${colors.surface} ${colors.border}`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${colors.accent}`} aria-hidden="true" />
      <div className={`absolute -right-8 -top-10 h-24 w-24 rounded-full opacity-[0.08] ${colors.accent}`} aria-hidden="true" />

      <button
        type="button"
        onClick={handleBack}
        className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-card/90 text-foreground shadow-sm transition-transform active:scale-95 touch-manipulation"
        aria-label="Torna indietro"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      {Icon && (
        <div className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ${colors.iconSurface}`}>
          <Icon className="h-6 w-6" />
        </div>
      )}

      <div className="relative z-10 min-w-0 flex-1 self-center">
        <h1 className="text-[clamp(1.25rem,5vw,1.5rem)] font-extrabold leading-tight text-foreground [overflow-wrap:anywhere]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground sm:text-sm">
            {subtitle}
          </p>
        )}
      </div>
    </header>
  );
};
