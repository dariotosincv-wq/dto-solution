import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { PageHeader } from '@/components/PageHeader';
import { Shield, Database, RefreshCw, BriefcaseBusiness } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  DEFAULT_DRIVER_CONTRACT_PROFILE,
  DRIVER_CONTRACT_PROFILE_STORAGE_KEY,
  normalizeDriverContractProfile,
  type DriverContractProfile,
  type IsoWeekday,
} from '@/lib/driverContractProfile';
import { getDriverPdfUserProfile, saveDriverPdfUserProfile } from '@/lib/driverPdf/driverPdfProfile';
import { resetUpdateDismissCooldown } from '@/lib/appUpdate';
import { Switch } from '@/components/ui/switch';
import {
  getDriverAutoFillNameEnabled,
  setDriverAutoFillNameEnabled,
} from '@/lib/driverAutoFillName';
import { getDriverCompanyName, setDriverCompanyName } from '@/lib/driverCompanyName';

const contractWeekdays: Array<{ value: IsoWeekday; label: string }> = [
  { value: 1, label: 'Lunedì' },
  { value: 2, label: 'Martedì' },
  { value: 3, label: 'Mercoledì' },
  { value: 4, label: 'Giovedì' },
  { value: 5, label: 'Venerdì' },
  { value: 6, label: 'Sabato' },
  { value: 7, label: 'Domenica' },
];

const Settings = () => {
  const navigate = useNavigate();

  const [defaultDriver, setDefaultDriver] = useState('AM');
  const [defaultProvince, setDefaultProvince] = useState('BG');
  const [driverPdfFirstName, setDriverPdfFirstName] = useState('');
  const [driverPdfLastName, setDriverPdfLastName] = useState('');
  const [driverPdfAliases, setDriverPdfAliases] = useState('');
  const [driverAutoFillName, setDriverAutoFillName] = useState(true);
  const [driverCompanyName, setDriverCompanyNameState] = useState('');
  const [appVersion, setAppVersion] = useState('Caricamento…');
  const [storedContractProfile, setStoredContractProfile] = useLocalStorage<DriverContractProfile>(
    DRIVER_CONTRACT_PROFILE_STORAGE_KEY,
    DEFAULT_DRIVER_CONTRACT_PROFILE,
  );
  const contractProfile = useMemo(
    () => normalizeDriverContractProfile(storedContractProfile),
    [storedContractProfile],
  );

  const updateContractProfile = (update: Partial<DriverContractProfile>) => {
    setStoredContractProfile(normalizeDriverContractProfile({ ...contractProfile, ...update }));
  };

  const toggleContractualWeekday = (weekday: IsoWeekday) => {
    const selected = contractProfile.contractualWeekdays.includes(weekday);
    updateContractProfile({
      contractualWeekdays: selected
        ? contractProfile.contractualWeekdays.filter((day) => day !== weekday)
        : [...contractProfile.contractualWeekdays, weekday],
    });
  };

  useEffect(() => {
    setDefaultDriver(localStorage.getItem('defaultDriver') || 'AM');
    setDefaultProvince(localStorage.getItem('defaultProvince') || 'BG');
    const profile = getDriverPdfUserProfile();
    setDriverPdfFirstName(profile.firstName);
    setDriverPdfLastName(profile.lastName);
    setDriverPdfAliases(profile.aliases.join('\n'));
    void getDriverAutoFillNameEnabled().then(setDriverAutoFillName);
    void getDriverCompanyName().then(setDriverCompanyNameState);
    if (Capacitor.isNativePlatform()) {
      void App.getInfo()
        .then((info) => setAppVersion(`${info.version} (build ${info.build})`))
        .catch((error) => {
          console.error('[Settings] Lettura versione Android non riuscita', error);
          setAppVersion('Versione Android non disponibile');
        });
    } else {
      setAppVersion('Versione disponibile nell’app installata');
    }
  }, []);

  const saveDriver = (value: string) => {
    setDefaultDriver(value);
    localStorage.setItem('defaultDriver', value);
  };

  const saveProvince = (value: string) => {
    setDefaultProvince(value);
    localStorage.setItem('defaultProvince', value);
  };

  const saveDriverPdfProfile = (nextProfile: {
    firstName?: string;
    lastName?: string;
    aliases?: string;
  }) => {
    const firstName = nextProfile.firstName ?? driverPdfFirstName;
    const lastName = nextProfile.lastName ?? driverPdfLastName;
    const aliases = nextProfile.aliases ?? driverPdfAliases;

    setDriverPdfFirstName(firstName);
    setDriverPdfLastName(lastName);
    setDriverPdfAliases(aliases);
    saveDriverPdfUserProfile({
      firstName,
      lastName,
      aliases: aliases
        .split(/[\n,;]/)
        .map((alias) => alias.trim())
        .filter(Boolean),
    });
  };

  return (
    <div className="page-container">
      <PageHeader title="Impostazioni" subtitle="Gestione app" />

      <div className="space-y-4">
        <div className="driver-card">
          <div className="mb-3 flex items-center gap-2">
            <BriefcaseBusiness size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">Contratto di lavoro</h3>
          </div>

          <label htmlFor="contract-type" className="text-xs font-medium text-muted-foreground">Tipo contratto</label>
          <select
            id="contract-type"
            aria-label="Tipo contratto"
            value={contractProfile.contractType}
            onChange={(event) => updateContractProfile({
              contractType: event.target.value === 'part_time' ? 'part_time' : 'full_time',
            })}
            className="driver-input mt-1 w-full"
          >
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
          </select>

          <label htmlFor="weekly-hours" className="mt-3 block text-xs font-medium text-muted-foreground">Ore settimanali</label>
          <input
            id="weekly-hours"
            aria-label="Ore settimanali"
            type="number"
            min="1"
            max="60"
            step="1"
            value={contractProfile.weeklyHours}
            onChange={(event) => updateContractProfile({ weeklyHours: Number(event.target.value) })}
            className="driver-input mt-1 w-full"
          />

          {contractProfile.contractType === 'part_time' && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-foreground">
                Giorni contrattuali settimanali: {contractProfile.contractualWeekdays.length}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {contractWeekdays.map(({ value, label }) => {
                  const selected = contractProfile.contractualWeekdays.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleContractualWeekday(value)}
                      className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition-colors ${
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Usato per interpretare correttamente turni e festività. I dati restano sul dispositivo.
          </p>
        </div>

        <div className="driver-card">
          <h3 className="font-semibold text-foreground mb-2">
            Vettore Driver
          </h3>

          <select
            value={defaultDriver}
            onChange={(e) => saveDriver(e.target.value)}
            className="driver-input w-full"
          >
            <option value="AM">AM</option>
            <option value="IN">IN</option>
            <option value="BR">BR</option>
            <option value="GL">GL</option>
            <option value="DH">DH</option>
            <option value="SD">SD</option>
            <option value="UP">UP</option>
            <option value="AL">AL</option>
          </select>

          <p className="text-xs text-muted-foreground mt-2">
            Usato automaticamente nei nuovi QR.
          </p>
        </div>

        <div className="driver-card">
          <h3 className="font-semibold text-foreground mb-2">
            Provincia di consegna
          </h3>

          <select
            value={defaultProvince}
            onChange={(e) => saveProvince(e.target.value)}
            className="driver-input w-full"
          >
            <option value="AG">AG</option>
<option value="AL">AL</option>
<option value="AN">AN</option>
<option value="AO">AO</option>
<option value="AP">AP</option>
<option value="AQ">AQ</option>
<option value="AR">AR</option>
<option value="AT">AT</option>
<option value="AV">AV</option>
<option value="BA">BA</option>
<option value="BG">BG</option>
<option value="BI">BI</option>
<option value="BL">BL</option>
<option value="BN">BN</option>
<option value="BO">BO</option>
<option value="BR">BR</option>
<option value="BS">BS</option>
<option value="BT">BT</option>
<option value="BZ">BZ</option>
<option value="CA">CA</option>
<option value="CB">CB</option>
<option value="CE">CE</option>
<option value="CH">CH</option>
<option value="CL">CL</option>
<option value="CN">CN</option>
<option value="CO">CO</option>
<option value="CR">CR</option>
<option value="CS">CS</option>
<option value="CT">CT</option>
<option value="CZ">CZ</option>
<option value="EN">EN</option>
<option value="FC">FC</option>
<option value="FE">FE</option>
<option value="FG">FG</option>
<option value="FI">FI</option>
<option value="FM">FM</option>
<option value="FR">FR</option>
<option value="GE">GE</option>
<option value="GO">GO</option>
<option value="GR">GR</option>
<option value="IM">IM</option>
<option value="IS">IS</option>
<option value="KR">KR</option>
<option value="LC">LC</option>
<option value="LE">LE</option>
<option value="LI">LI</option>
<option value="LO">LO</option>
<option value="LT">LT</option>
<option value="LU">LU</option>
<option value="MB">MB</option>
<option value="MC">MC</option>
<option value="ME">ME</option>
<option value="MI">MI</option>
<option value="MN">MN</option>
<option value="MO">MO</option>
<option value="MS">MS</option>
<option value="MT">MT</option>
<option value="NA">NA</option>
<option value="NO">NO</option>
<option value="NU">NU</option>
<option value="OR">OR</option>
<option value="PA">PA</option>
<option value="PC">PC</option>
<option value="PD">PD</option>
<option value="PE">PE</option>
<option value="PG">PG</option>
<option value="PI">PI</option>
<option value="PN">PN</option>
<option value="PO">PO</option>
<option value="PR">PR</option>
<option value="PT">PT</option>
<option value="PU">PU</option>
<option value="PV">PV</option>
<option value="PZ">PZ</option>
<option value="RA">RA</option>
<option value="RC">RC</option>
<option value="RE">RE</option>
<option value="RG">RG</option>
<option value="RI">RI</option>
<option value="RM">RM</option>
<option value="RN">RN</option>
<option value="RO">RO</option>
<option value="SA">SA</option>
<option value="SI">SI</option>
<option value="SO">SO</option>
<option value="SP">SP</option>
<option value="SR">SR</option>
<option value="SS">SS</option>
<option value="SU">SU</option>
<option value="SV">SV</option>
<option value="TA">TA</option>
<option value="TE">TE</option>
<option value="TN">TN</option>
<option value="TO">TO</option>
<option value="TP">TP</option>
<option value="TR">TR</option>
<option value="TS">TS</option>
<option value="TV">TV</option>
<option value="UD">UD</option>
<option value="VA">VA</option>
<option value="VB">VB</option>
<option value="VC">VC</option>
<option value="VE">VE</option>
<option value="VI">VI</option>
<option value="VR">VR</option>
<option value="VT">VT</option>
<option value="VV">VV</option>
          </select>

          <p className="text-xs text-muted-foreground mt-2">
            Usata automaticamente per salvare e cercare QR nel Cloud.
          </p>
        </div>

        <div className="driver-card">
          <h3 className="font-semibold text-foreground mb-2">
            Profilo Driver PDF
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="driver-pdf-first-name" className="text-xs font-medium text-muted-foreground">
                Nome
              </label>
              <input
                id="driver-pdf-first-name"
                value={driverPdfFirstName}
                onChange={(event) => saveDriverPdfProfile({ firstName: event.target.value })}
                className="driver-input w-full mt-1"
                autoComplete="given-name"
              />
            </div>

            <div>
              <label htmlFor="driver-pdf-last-name" className="text-xs font-medium text-muted-foreground">
                Cognome
              </label>
              <input
                id="driver-pdf-last-name"
                value={driverPdfLastName}
                onChange={(event) => saveDriverPdfProfile({ lastName: event.target.value })}
                className="driver-input w-full mt-1"
                autoComplete="family-name"
              />
            </div>
          </div>

          <label htmlFor="driver-company-name" className="text-xs font-medium text-muted-foreground block mt-3">
            Nome della ditta
          </label>
          <input
            id="driver-company-name"
            value={driverCompanyName}
            onChange={(event) => {
              setDriverCompanyNameState(event.target.value);
              void setDriverCompanyName(event.target.value);
            }}
            className="driver-input w-full mt-1"
            autoComplete="organization"
          />

          <label htmlFor="driver-pdf-aliases" className="text-xs font-medium text-muted-foreground block mt-3">
            Alias
          </label>
          <textarea
            id="driver-pdf-aliases"
            value={driverPdfAliases}
            onChange={(event) => saveDriverPdfProfile({ aliases: event.target.value })}
            className="driver-input w-full mt-1 min-h-[86px]"
          />

          <p className="text-xs text-muted-foreground mt-2">
            Usato solo in locale per trovare il tuo nome nei PDF aperti con Driver Utility.
          </p>

          <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border p-3">
            <div className="min-w-0">
              <label htmlFor="driver-auto-fill-name" className="text-sm font-semibold text-foreground">
                Compila automaticamente il nome del driver
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Usa il nome e cognome salvati nelle Impostazioni per compilare automaticamente le nuove ispezioni.
              </p>
            </div>
            <Switch
              id="driver-auto-fill-name"
              checked={driverAutoFillName}
              onCheckedChange={(checked) => {
                setDriverAutoFillName(checked);
                void setDriverAutoFillNameEnabled(checked);
              }}
              aria-label="Compila automaticamente il nome del driver"
            />
          </div>
        </div>

        <div className="driver-card">
          <h3 className="font-semibold text-foreground mb-1">Versione App</h3>
          <p className="text-sm text-muted-foreground">
            Driver Utility {appVersion}
          </p>
        </div>

        {import.meta.env.DEV && (
          <div className="driver-card border-dashed border-2">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw size={18} className="text-primary" />
              <h3 className="font-semibold text-foreground">Test aggiornamenti (sviluppo)</h3>
            </div>
            <button
              type="button"
              className="driver-btn-outline w-full text-sm"
              onClick={() => {
                resetUpdateDismissCooldown();
                window.dispatchEvent(new Event('driverUtility:checkUpdate'));
              }}
            >
              Azzera cooldown e ricontrolla
            </button>
          </div>
        )}

        <div className="driver-card">
          <div className="flex items-center gap-2 mb-2">
            <Database size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">
              Dati e Backup
            </h3>
          </div>

          <p className="text-sm text-muted-foreground">
            I QR possono essere salvati sul dispositivo
            <br />
            e sincronizzati nel Cloud per backup
            <br />
            e recupero dei dati.
          </p>
        </div>

        <div className="driver-card">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">Privacy</h3>
          </div>

          <button
            type="button"
            onClick={() => navigate('/privacy')}
            className="driver-btn-outline w-full text-sm"
          >
            Visualizza Privacy & Uso Dati
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
