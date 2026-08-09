import { useState } from 'react'
import { useSupabaseAuth } from '../../auth/useSupabaseAuth.js'
import { useNacScanPromotion } from '../../hooks/useNacScanPromotion.js'
import { useI18n } from '../../i18n/useI18n.js'

function getUserName(user) {
  return user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email
    || 'Utente Google'
}

function formatDate(value, language) {
  if (!value) return ''

  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'it-IT', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Rome',
  }).format(new Date(value))
}

const claimMessages = {
  pending: 'Adesione registrata. Il tuo account è stato associato alla promozione NACScan.',
  verified: 'Promozione verificata: diritto permanente attivo.',
  rejected: 'Adesione non approvata.',
}

function ClaimStatus({ claim, language }) {
  const status = claim.status in claimMessages ? claim.status : 'pending'

  return (
    <div className={`nacscan-claim nacscan-claim--${status}`}>
      <p className="nacscan-claim__badge">Stato: {claim.status}</p>
      <p className="nacscan-claim__message">{claimMessages[status]}</p>
      <dl className="nacscan-claim__details">
        <div>
          <dt>Adesione richiesta</dt>
          <dd>{formatDate(claim.requested_at, language)}</dd>
        </div>
        {claim.permanent_entitlement_at ? (
          <div>
            <dt>Diritto permanente attivato</dt>
            <dd>{formatDate(claim.permanent_entitlement_at, language)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}

function NacScanPromotion({ playStoreUrl }) {
  const { language } = useI18n()
  const {
    isConfigured,
    isAuthenticated,
    isLoading,
    user,
    userId,
    email,
    error: authError,
    loginWithGoogle,
    logout,
  } = useSupabaseAuth()
  const {
    claim,
    claimPromotion,
    error: promotionError,
    errorContext,
    isClaiming,
    isExpired,
    isLoading: isLoadingClaim,
    refresh,
  } = useNacScanPromotion({ isAuthenticated, userId })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')

  const handleLogin = async () => {
    setActionError('')
    setIsSubmitting(true)

    try {
      await loginWithGoogle()
    } catch {
      setActionError('Accesso con Google non riuscito. Riprova tra poco.')
      setIsSubmitting(false)
    }
  }

  const handleLogout = async () => {
    setActionError('')
    setIsSubmitting(true)

    try {
      await logout()
    } catch {
      setActionError('Non è stato possibile uscire. Riprova tra poco.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="nacscan-promotion" aria-labelledby="nacscan-promotion-title">
      <div className="nacscan-promotion__copy">
        <p className="eyebrow">Promozione 2026</p>
        <h2 id="nacscan-promotion-title">Scarica NACScan entro il 30 settembre: sarà gratis per sempre.</h2>
        <p>Scarica NACScan dal Google Play Store entro il 30 settembre 2026. Accedi con Google per identificare l’account che potrà essere associato alla promozione.</p>
        <p className="nacscan-promotion__note">Il login identifica l’utente, ma non conferma automaticamente il download né assegna il diritto promozionale.</p>
        <a className="button button--primary" href={playStoreUrl} target="_blank" rel="noopener noreferrer">
          Scarica dal Play Store
        </a>
      </div>

      <div className="nacscan-auth" aria-live="polite" aria-busy={isLoading || isLoadingClaim || isClaiming || isSubmitting}>
        <p className="nacscan-auth__label">Account promozione</p>

        {isLoading ? <p>Verifica della sessione…</p> : null}

        {!isLoading && isAuthenticated ? (
          <>
            <p className="nacscan-auth__status">Account autenticato</p>
            <p className="nacscan-auth__user">
              <strong>{getUserName(user)}</strong>
              {email && getUserName(user) !== email ? <span>{email}</span> : null}
            </p>
            {isLoadingClaim ? <p className="nacscan-auth__pending">Verifica dell’adesione esistente…</p> : null}

            {!isLoadingClaim && claim ? <ClaimStatus claim={claim} language={language} /> : null}

            {!isLoadingClaim && !claim && !isExpired && errorContext !== 'load' ? (
              <>
                <p className="nacscan-auth__pending">Account identificato. Puoi ora registrare l’adesione alla promozione.</p>
                <button className="button button--primary" type="button" onClick={claimPromotion} disabled={isClaiming || isSubmitting}>
                  {isClaiming ? 'Registrazione in corso…' : 'Aderisci alla promozione'}
                </button>
              </>
            ) : null}

            {!isLoadingClaim && !claim && errorContext === 'load' ? (
              <button className="button button--secondary" type="button" onClick={refresh}>
                Riprova la verifica
              </button>
            ) : null}

            <button className="button button--secondary" type="button" onClick={handleLogout} disabled={isSubmitting}>
              {isSubmitting ? 'Uscita…' : 'Esci'}
            </button>
          </>
        ) : null}

        {!isLoading && !isAuthenticated ? (
          <>
            <p>Continua con Google per identificare l’account che potrà essere associato alla promozione NACScan.</p>
            <button className="button button--google" type="button" onClick={handleLogin} disabled={!isConfigured || isSubmitting}>
              <span className="nacscan-google-mark" aria-hidden="true">G</span>
              {isSubmitting ? 'Reindirizzamento…' : 'Continua con Google'}
            </button>
            {!isConfigured ? <p className="nacscan-auth__configuration">Autenticazione temporaneamente non disponibile.</p> : null}
          </>
        ) : null}

        {isExpired ? <p className="nacscan-auth__expired" role="status">La promozione NACScan è terminata il 30 settembre 2026.</p> : null}
        {!isExpired && promotionError ? <p className="nacscan-auth__error" role="alert">{promotionError}</p> : null}
        {actionError || authError ? <p className="nacscan-auth__error" role="alert">{actionError || 'Si è verificato un errore durante l’autenticazione. Riprova.'}</p> : null}
      </div>
    </section>
  )
}

export default NacScanPromotion
