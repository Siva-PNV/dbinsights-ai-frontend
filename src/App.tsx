import { useEffect, useState } from 'react'
import {
  Activity,
  Bell,
  Check,
  CircleHelp,
  Database,
  Ellipsis,
  Gauge,
  GitBranch,
  Lightbulb,
  Menu,
  Plus,
  X,
} from 'lucide-react'
import {
  getAlertSummary,
  getApiErrorMessage,
  getCurrentUser,
  getHealthScore,
  getLiveRecommendations,
  getLiveSchemaMetadata,
  getMonitoredDatabases,
  getQueryTelemetry,
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  resendEmailVerification,
  resetPassword,
  updateRecommendationStatus,
  verifyEmail,
  type AlertSummary,
  type AuthUser,
  type HealthScore,
  type LiveRecommendationResponse,
  type LiveSchemaMetadata,
  type MonitoredDatabase,
  type QueryTelemetry,
} from './api'
import type { Section } from './types'
import { Overview, NoLiveDataPage } from './pages/OverviewPages'
import { LiveQueryPage, LiveSchemaPage, LiveRecommendationsPage } from './pages/AnalysisPages'
import { LiveConnectionsPage } from './pages/ConnectionsPage'
import { LogoutConfirmationModal } from './components/LogoutConfirmationModal'

const selectedDatabaseStorageKey = (userId: number) => `dbinsight-selected-database-id:${userId}`
type AuthField = 'name' | 'email' | 'password' | 'confirmPassword'
type AuthFieldErrors = Partial<Record<AuthField, string>>

const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

const navItems: { label: Section; icon: typeof Gauge }[] = [
  { label: 'Overview', icon: Gauge },
  { label: 'Query performance', icon: Activity },
  { label: 'Schema explorer', icon: GitBranch },
  { label: 'Recommendations', icon: Lightbulb },
  { label: 'Connections', icon: Database },
]

function App() {
  const [section, setSection] = useState<Section>('Overview')
  const [monitoredDatabases, setMonitoredDatabases] = useState<MonitoredDatabase[]>([])
  const [databaseRegistryLoaded, setDatabaseRegistryLoaded] = useState(false)
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<number | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [notice, setNotice] = useState('')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [passwordResetToken, setPasswordResetToken] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get('resetToken') ?? '',
  )
  const [verificationToken, setVerificationToken] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get('verifyToken') ?? '',
  )
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot' | 'reset' | 'verify'>(
    () => {
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      return hashParams.has('resetToken')
        ? 'reset'
        : hashParams.has('verifyToken')
          ? 'verify'
          : 'login'
    },
  )
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotStatus, setForgotStatus] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [resetPasswordForm, setResetPasswordForm] = useState({ password: '', confirmPassword: '' })
  const [authFieldErrors, setAuthFieldErrors] = useState<AuthFieldErrors>({})
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [canResendVerification, setCanResendVerification] = useState(false)
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null)
  const [healthLoaded, setHealthLoaded] = useState(false)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [queryTelemetry, setQueryTelemetry] = useState<QueryTelemetry | null>(null)
  const [includeInternalQueries, setIncludeInternalQueries] = useState(false)
  const [liveRecommendations, setLiveRecommendations] = useState<LiveRecommendationResponse | null>(
    null,
  )
  const [recommendationError, setRecommendationError] = useState<string | null>(null)
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null)
  const [alertError, setAlertError] = useState<string | null>(null)
  const [schemaMetadata, setSchemaMetadata] = useState<LiveSchemaMetadata | null>(null)
  const [schemaMetadataError, setSchemaMetadataError] = useState<string | null>(null)

  useEffect(() => {
    void getCurrentUser()
      .then(setAuthUser)
      .catch(() => setAuthUser(null))
      .finally(() => setAuthChecked(true))
  }, [])
  useEffect(() => {
    if (!verificationToken || !authChecked) return
    setAuthView('verify')
    setAuthError('')
    setAuthBusy(true)
    void verifyEmail(verificationToken)
      .then((result) => {
        setAuthUser(null)
        setForgotStatus(result.message)
      })
      .catch((error: unknown) => {
        const responseBody = (
          error as { response?: { data?: { detail?: string; message?: string } } }
        ).response?.data
        setAuthError(
          responseBody?.detail ??
            responseBody?.message ??
            (error instanceof Error ? error.message : 'Unable to verify this email.'),
        )
      })
      .finally(() => {
        setVerificationToken('')
        setAuthView('login')
        const currentUrl = new URL(window.location.href)
        currentUrl.hash = ''
        window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}`)
        setAuthBusy(false)
      })
  }, [authChecked, verificationToken])
  useEffect(() => {
    const handleExpiredSession = () => {
      setAuthUser(null)
      setAuthChecked(true)
      setHealthScore(null)
      setHealthLoaded(false)
      setQueryTelemetry(null)
      setSchemaMetadata(null)
      setLiveRecommendations(null)
      setAlertSummary(null)
    }
    window.addEventListener('dbinsight-session-expired', handleExpiredSession)
    return () => window.removeEventListener('dbinsight-session-expired', handleExpiredSession)
  }, [])

  const persistAuthUser = (user: AuthUser | null) => {
    setAuthUser(user)
    if (!user) void logoutUser().catch(() => {})
  }
  const isAdmin = authUser?.role.replace(/^ROLE_/, '').toUpperCase() === 'ADMIN'
  const clearAuthFieldError = (field: AuthField) => {
    setAuthFieldErrors((current) => {
      if (!(field in current)) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fieldErrors: AuthFieldErrors = {}
    if (authView === 'register' && !authForm.name.trim()) {
      fieldErrors.name = 'Name is required.'
    }
    if (!authForm.email.trim()) {
      fieldErrors.email = 'Email is required.'
    } else if (!validateEmail(authForm.email)) {
      fieldErrors.email = 'Enter a valid email address.'
    }
    if (!authForm.password) {
      fieldErrors.password = 'Password is required.'
    } else if (authForm.password.length < 8) {
      fieldErrors.password = 'Password must be at least 8 characters.'
    }
    setAuthFieldErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    setAuthError('')
    setForgotStatus('')
    setCanResendVerification(false)
    setAuthBusy(true)

    try {
      if (authView === 'login') {
        const user = await loginUser(authForm.email.trim(), authForm.password)
        persistAuthUser(user)
        setAuthForm({ name: '', email: '', password: '' })
      } else {
        const result = await registerUser(
          authForm.name.trim(),
          authForm.email.trim(),
          authForm.password,
        )
        setAuthForm({ name: '', email: '', password: '' })
        if (result.verificationRequired) {
          setAuthView('login')
          setForgotStatus(result.message)
        } else if (result.user) {
          persistAuthUser(result.user)
        } else {
          throw new Error('Registration completed without an account response.')
        }
      }
    } catch (error) {
      const responseError = error as {
        response?: { status?: number; data?: { detail?: string; message?: string } }
      }
      const responseBody = responseError.response?.data
      const loginDenied = authView === 'login' && responseError.response?.status === 401
      const responseStatus = responseError.response?.status
      const responseDetail = responseBody?.detail ?? responseBody?.message ?? ''
      const loginRequiresVerification =
        authView === 'login' &&
        responseStatus === 403 &&
        /verify your email address before signing in/i.test(responseDetail)
      const registrationAccountExists = authView === 'register' && responseStatus === 409
      setCanResendVerification(loginRequiresVerification || registrationAccountExists)
      setAuthError(
        loginDenied
          ? 'Invalid email or password.'
          : loginRequiresVerification
            ? 'Please verify your email address before signing in. Check your inbox or resend the verification email below.'
            : registrationAccountExists
              ? 'An account with this email may already exist. Verify your email or sign in. You can resend the verification email below.'
              : (responseDetail ||
                (error instanceof Error ? error.message : 'Authentication failed.')),
      )
    } finally {
      setAuthBusy(false)
    }
  }

  const handleResendVerification = async () => {
    if (!authForm.email.trim()) {
      setAuthFieldErrors({ email: 'Email is required.' })
      return
    }
    if (!validateEmail(authForm.email)) {
      setAuthFieldErrors({ email: 'Enter a valid email address.' })
      return
    }
    setAuthFieldErrors({})
    setAuthError('')
    setForgotStatus('')
    setAuthBusy(true)
    try {
      const result = await resendEmailVerification(authForm.email)
      setForgotStatus(result.message)
      setCanResendVerification(false)
    } catch (error) {
      const responseBody = (
        error as { response?: { data?: { detail?: string; message?: string } } }
      ).response?.data
      setAuthError(
        responseBody?.detail ??
          responseBody?.message ??
          (error instanceof Error ? error.message : 'Unable to resend the verification email.'),
      )
    } finally {
      setAuthBusy(false)
    }
  }

  const handleForgotSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!forgotEmail.trim()) {
      setAuthFieldErrors({ email: 'Email is required.' })
      return
    }
    if (!validateEmail(forgotEmail)) {
      setAuthFieldErrors({ email: 'Enter a valid email address.' })
      return
    }
    setAuthFieldErrors({})
    setForgotStatus('')
    setForgotError('')
    setAuthBusy(true)
    try {
      const result = await requestPasswordReset(forgotEmail)
      setForgotStatus(result.message)
    } catch (error) {
      const responseBody = (
        error as { response?: { data?: { detail?: string; message?: string } } }
      ).response?.data
      setForgotError(
        responseBody?.detail ??
          responseBody?.message ??
          (error instanceof Error ? error.message : 'Unable to request a password reset.'),
      )
    } finally {
      setAuthBusy(false)
    }
  }

  const handlePasswordResetSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')
    const fieldErrors: AuthFieldErrors = {}
    if (!resetPasswordForm.password) {
      fieldErrors.password = 'Password is required.'
    } else if (resetPasswordForm.password.length < 8) {
      fieldErrors.password = 'Password must be at least 8 characters.'
    }
    if (!resetPasswordForm.confirmPassword) {
      fieldErrors.confirmPassword = 'Please confirm your password.'
    } else if (resetPasswordForm.confirmPassword.length < 8) {
      fieldErrors.confirmPassword = 'Password must be at least 8 characters.'
    } else if (resetPasswordForm.password !== resetPasswordForm.confirmPassword) {
      fieldErrors.confirmPassword = 'Passwords do not match.'
    }
    setAuthFieldErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return
    setAuthBusy(true)
    try {
      const result = await resetPassword(passwordResetToken, resetPasswordForm.password)
      setPasswordResetToken('')
      setResetPasswordForm({ password: '', confirmPassword: '' })
      setAuthUser(null)
      setAuthView('login')
      const currentUrl = new URL(window.location.href)
      currentUrl.hash = ''
      window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}`)
      setAuthError('')
      setForgotStatus(result.message)
    } catch (error) {
      const responseBody = (
        error as { response?: { data?: { detail?: string; message?: string } } }
      ).response?.data
      setAuthError(
        responseBody?.detail ??
          responseBody?.message ??
          (error instanceof Error ? error.message : 'Unable to reset the password.'),
      )
    } finally {
      setAuthBusy(false)
    }
  }

  const notify = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }
  const selectedDatabaseName =
    monitoredDatabases.find((target) => target.databaseId === selectedDatabaseId)?.databaseName ??
    'selected database'
  useEffect(() => {
    if (healthError) notify(`Could not load ${selectedDatabaseName}: ${healthError}`)
  }, [healthError, selectedDatabaseName])
  useEffect(() => {
    if (!authChecked) return
    if (!authUser) {
      setMonitoredDatabases([])
      setSelectedDatabaseId(null)
      setDatabaseRegistryLoaded(true)
      setHealthScore(null)
      setHealthLoaded(false)
      setQueryTelemetry(null)
      setSchemaMetadata(null)
      setLiveRecommendations(null)
      setAlertSummary(null)
      return
    }
    setMonitoredDatabases([])
    setSelectedDatabaseId(null)
    setDatabaseRegistryLoaded(false)
    setHealthScore(null)
    setHealthLoaded(false)
    setHealthError(null)
    setQueryTelemetry(null)
    setSchemaMetadata(null)
    setLiveRecommendations(null)
    setAlertSummary(null)
    void getMonitoredDatabases()
      .then((targets) => {
        setMonitoredDatabases(targets)
        const storedDatabaseId = Number(
          window.localStorage.getItem(selectedDatabaseStorageKey(authUser.userId)),
        )
        const preferredTarget =
          targets.find(
            (target) => target.databaseId === storedDatabaseId && target.status === 'ACTIVE',
          ) ?? targets.find((target) => target.status === 'ACTIVE')
        setSelectedDatabaseId(preferredTarget?.databaseId ?? null)
      })
      .catch(() => setMonitoredDatabases([]))
      .finally(() => setDatabaseRegistryLoaded(true))
  }, [authChecked, authUser?.userId])
  useEffect(() => {
    if (authUser && selectedDatabaseId !== null) {
      window.localStorage.setItem(
        selectedDatabaseStorageKey(authUser.userId),
        String(selectedDatabaseId),
      )
    }
  }, [authUser?.userId, selectedDatabaseId])
  useEffect(() => {
    if (!authUser) return
    const refreshDatabaseRegistry = () => {
      setDatabaseRegistryLoaded(false)
      void getMonitoredDatabases()
        .then((targets) => {
          setMonitoredDatabases(targets)
          setSelectedDatabaseId((current) =>
            current &&
            targets.some((target) => target.databaseId === current && target.status === 'ACTIVE')
              ? current
              : (targets.find(
                  (target) =>
                    target.databaseId ===
                      Number(
                        window.localStorage.getItem(selectedDatabaseStorageKey(authUser.userId)),
                      ) && target.status === 'ACTIVE',
                )?.databaseId ??
                targets.find((target) => target.status === 'ACTIVE')?.databaseId ??
                null),
          )
        })
        .catch(() => setMonitoredDatabases([]))
        .finally(() => setDatabaseRegistryLoaded(true))
    }
    window.addEventListener('dbinsight-databases-updated', refreshDatabaseRegistry)
    return () => window.removeEventListener('dbinsight-databases-updated', refreshDatabaseRegistry)
  }, [authUser?.userId])
  useEffect(() => {
    if (!authChecked || !authUser || !databaseRegistryLoaded) return
    if (selectedDatabaseId === null) {
      setHealthScore(null)
      setHealthError(null)
      setHealthLoaded(true)
      return
    }
    let active = true
    setHealthLoaded(false)
    setHealthScore(null)
    setHealthError(null)
    setQueryTelemetry(null)
    setSchemaMetadata(null)
    setSchemaMetadataError(null)
    setLiveRecommendations(null)
    setRecommendationError(null)
    void getHealthScore(selectedDatabaseId ?? undefined)
      .then((score) => {
        if (active) setHealthScore(score)
      })
      .catch((error: unknown) => {
        if (!active) return
        setHealthScore(null)
        const responseBody = (
          error as { response?: { data?: { detail?: string; message?: string } } }
        ).response?.data
        setHealthError(
          responseBody?.detail ??
            responseBody?.message ??
            (error instanceof Error ? error.message : 'Unable to load this database.'),
        )
      })
      .finally(() => {
        if (active) setHealthLoaded(true)
      })
    return () => {
      active = false
    }
  }, [authChecked, authUser?.userId, databaseRegistryLoaded, selectedDatabaseId])
  useEffect(() => {
    if (!authUser || !healthLoaded || selectedDatabaseId === null) return
    const intervalId = window.setInterval(() => {
      void getHealthScore(selectedDatabaseId)
        .then((score) => {
          setHealthScore(score)
          setHealthError(null)
        })
        .catch((error: unknown) => {
          setHealthScore(null)
          const responseBody = (
            error as { response?: { data?: { detail?: string; message?: string } } }
          ).response?.data
          setHealthError(
            responseBody?.detail ??
              responseBody?.message ??
              (error instanceof Error ? error.message : 'Unable to load this database.'),
          )
        })
    }, 30_000)
    return () => window.clearInterval(intervalId)
  }, [authUser?.userId, healthLoaded, selectedDatabaseId])
  useEffect(() => {
    if (!healthLoaded || !healthScore || healthScore.demoData) return
    const refreshTelemetry = () => {
      void getQueryTelemetry(includeInternalQueries, selectedDatabaseId ?? undefined)
        .then(setQueryTelemetry)
        .catch(() => setQueryTelemetry(null))
    }
    refreshTelemetry()
    const intervalId = window.setInterval(refreshTelemetry, 30_000)
    return () => window.clearInterval(intervalId)
  }, [healthLoaded, healthScore, includeInternalQueries, selectedDatabaseId])
  useEffect(() => {
    if (!healthLoaded || !healthScore || healthScore.demoData) return
    const refreshRecommendations = () => {
      void getLiveRecommendations(selectedDatabaseId ?? undefined)
        .then((result) => {
          setLiveRecommendations(result)
          setRecommendationError(null)
        })
        .catch((error: unknown) => {
          setLiveRecommendations(null)
          setRecommendationError(getApiErrorMessage(error, 'Unable to load live recommendations.'))
        })
    }
    refreshRecommendations()
    const intervalId = window.setInterval(refreshRecommendations, 60_000)
    return () => window.clearInterval(intervalId)
  }, [healthLoaded, healthScore, selectedDatabaseId])
  useEffect(() => {
    if (!healthLoaded || !healthScore || healthScore.demoData) return
    const refreshAlerts = () => {
      void getAlertSummary()
        .then((result) => {
          setAlertSummary(result)
          setAlertError(null)
        })
        .catch((error: unknown) => {
          setAlertSummary(null)
          setAlertError(error instanceof Error ? error.message : 'Unable to load live alerts.')
        })
    }
    refreshAlerts()
    const intervalId = window.setInterval(refreshAlerts, 60_000)
    return () => window.clearInterval(intervalId)
  }, [healthLoaded, healthScore])
  useEffect(() => {
    if (!healthLoaded || !healthScore || healthScore.demoData) return
    const refreshSchema = () => {
      void getLiveSchemaMetadata(selectedDatabaseId ?? undefined)
        .then((schema) => {
          setSchemaMetadata(schema)
          setSchemaMetadataError(null)
        })
        .catch((error: unknown) => {
          setSchemaMetadata(null)
          setSchemaMetadataError(
            error instanceof Error ? error.message : 'Unable to load live schema metadata.',
          )
        })
    }
    refreshSchema()
    const intervalId = window.setInterval(refreshSchema, 60_000)
    return () => window.clearInterval(intervalId)
  }, [healthLoaded, healthScore, selectedDatabaseId])

  if (!authChecked) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          color: '#547264',
          background: '#f7faf5',
          fontSize: 14,
        }}
      >
        Restoring your session…
      </div>
    )
  }

  if (!authUser || authView === 'reset' || authView === 'verify') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: 'linear-gradient(135deg, #0d1713 0%, #1b2b24 100%)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 460,
            background: '#f7faf5',
            borderRadius: 18,
            boxShadow: '0 20px 80px rgba(12, 29, 19, 0.25)',
            padding: 28,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 38,
                height: 38,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 12,
                background: '#dfeee0',
                color: '#174327',
                fontWeight: 700,
              }}
            >
              D
            </div>
            <div>
              <div
                style={{ fontSize: 11, letterSpacing: '0.18em', color: '#547264', fontWeight: 700 }}
              >
                DBINSIGHT AI
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#123624' }}>
                Database observability
              </div>
            </div>
          </div>
          {authView !== 'forgot' && authView !== 'reset' && authView !== 'verify' && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                background: '#ebf1eb',
                borderRadius: 12,
                padding: 6,
                marginBottom: 20,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setAuthFieldErrors({})
                  setAuthView('login')
                }}
                style={{
                  flex: 1,
                  border: 'none',
                  borderRadius: 10,
                  background: authView === 'login' ? '#ffffff' : 'transparent',
                  height: 38,
                  fontWeight: 700,
                  color: '#123624',
                  cursor: 'pointer',
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthFieldErrors({})
                  setAuthView('register')
                }}
                style={{
                  flex: 1,
                  border: 'none',
                  borderRadius: 10,
                  background: authView === 'register' ? '#ffffff' : 'transparent',
                  height: 38,
                  fontWeight: 700,
                  color: '#123624',
                  cursor: 'pointer',
                }}
              >
                Register
              </button>
            </div>
          )}
          {authView === 'verify' ? (
            <div role="status" style={{ color: '#315d3e', fontSize: 14, padding: '12px 0' }}>
              Verifying your email address…
            </div>
          ) : authView === 'forgot' ? (
            <form noValidate onSubmit={handleForgotSubmit} style={{ display: 'grid', gap: 16 }}>
              <div>
                <h2 style={{ margin: '0 0 6px', color: '#123624', fontSize: 19 }}>
                  Forgot password?
                </h2>
                <p style={{ color: '#547264', fontSize: 13, lineHeight: 1.5 }}>
                  Enter the email address associated with your account.
                </p>
              </div>
              <label
                style={{ display: 'grid', gap: 8, fontSize: 13, color: '#214434', fontWeight: 600 }}
              >
                Email
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(event) => {
                    setForgotEmail(event.target.value)
                    setForgotStatus('')
                    setForgotError('')
                    clearAuthFieldError('email')
                  }}
                  aria-invalid={Boolean(authFieldErrors.email)}
                  aria-describedby={authFieldErrors.email ? 'forgot-email-error' : undefined}
                  style={{
                    height: 42,
                    borderRadius: 10,
                    border: '1px solid #d2dcd2',
                    padding: '0 12px',
                    fontSize: 15,
                  }}
                />
                {authFieldErrors.email && (
                  <small id="forgot-email-error" className="field-validation-error" role="alert">
                    {authFieldErrors.email}
                  </small>
                )}
              </label>
              {forgotError && (
                <div
                  role="alert"
                  style={{
                    background: '#fde8e8',
                    color: '#7e1f1f',
                    border: '1px solid #f0b4b4',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 14,
                  }}
                >
                  {forgotError}
                </div>
              )}
              {forgotStatus && (
                <div
                  role="status"
                  style={{
                    background: '#edf4ed',
                    color: '#315d3e',
                    border: '1px solid #d4e3d4',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 13,
                  }}
                >
                  {forgotStatus}
                </div>
              )}
              <button
                type="submit"
                disabled={authBusy}
                style={{
                  height: 46,
                  border: 'none',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #163d2f 0%, #245b41 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: authBusy ? 'not-allowed' : 'pointer',
                  opacity: authBusy ? 0.7 : 1,
                }}
              >
                {authBusy ? 'Sending…' : 'Send reset link'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthView('login')
                  setForgotStatus('')
                  setForgotError('')
                  setAuthFieldErrors({})
                }}
                style={{
                  height: 42,
                  border: '1px solid #d2dcd2',
                  borderRadius: 10,
                  background: '#fff',
                  color: '#214434',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Back to sign in
              </button>
            </form>
          ) : authView === 'reset' ? (
            <form
              noValidate
              onSubmit={handlePasswordResetSubmit}
              style={{ display: 'grid', gap: 16 }}
            >
              <div>
                <h2 style={{ margin: '0 0 6px', color: '#123624', fontSize: 19 }}>
                  Choose a new password
                </h2>
                <p style={{ color: '#547264', fontSize: 13, lineHeight: 1.5 }}>
                  Enter and confirm your new password.
                </p>
              </div>
              <label
                style={{ display: 'grid', gap: 8, fontSize: 13, color: '#214434', fontWeight: 600 }}
              >
                New password
                <input
                  type="password"
                  value={resetPasswordForm.password}
                  onChange={(event) => {
                    setResetPasswordForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                    clearAuthFieldError('password')
                  }}
                  aria-invalid={Boolean(authFieldErrors.password)}
                  aria-describedby={authFieldErrors.password ? 'reset-password-error' : undefined}
                  autoComplete="new-password"
                  style={{
                    height: 42,
                    borderRadius: 10,
                    border: '1px solid #d2dcd2',
                    padding: '0 12px',
                    fontSize: 15,
                  }}
                />
                {authFieldErrors.password && (
                  <small id="reset-password-error" className="field-validation-error" role="alert">
                    {authFieldErrors.password}
                  </small>
                )}
              </label>
              <label
                style={{ display: 'grid', gap: 8, fontSize: 13, color: '#214434', fontWeight: 600 }}
              >
                Confirm new password
                <input
                  type="password"
                  value={resetPasswordForm.confirmPassword}
                  onChange={(event) => {
                    setResetPasswordForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                    clearAuthFieldError('confirmPassword')
                  }}
                  aria-invalid={Boolean(authFieldErrors.confirmPassword)}
                  aria-describedby={
                    authFieldErrors.confirmPassword ? 'reset-confirm-password-error' : undefined
                  }
                  autoComplete="new-password"
                  style={{
                    height: 42,
                    borderRadius: 10,
                    border: '1px solid #d2dcd2',
                    padding: '0 12px',
                    fontSize: 15,
                  }}
                />
                {authFieldErrors.confirmPassword && (
                  <small
                    id="reset-confirm-password-error"
                    className="field-validation-error"
                    role="alert"
                  >
                    {authFieldErrors.confirmPassword}
                  </small>
                )}
              </label>
              {authError && (
                <div
                  role="alert"
                  style={{
                    background: '#fde8e8',
                    color: '#7e1f1f',
                    border: '1px solid #f0b4b4',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 14,
                  }}
                >
                  {authError}
                </div>
              )}
              <button
                type="submit"
                disabled={authBusy || !passwordResetToken}
                style={{
                  height: 46,
                  border: 'none',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #163d2f 0%, #245b41 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: authBusy || !passwordResetToken ? 'not-allowed' : 'pointer',
                  opacity: authBusy || !passwordResetToken ? 0.7 : 1,
                }}
              >
                {authBusy ? 'Updating…' : 'Update password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasswordResetToken('')
                  setAuthError('')
                  setAuthFieldErrors({})
                  setAuthView('login')
                  const currentUrl = new URL(window.location.href)
                  currentUrl.hash = ''
                  window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}`)
                }}
                style={{
                  height: 42,
                  border: '1px solid #d2dcd2',
                  borderRadius: 10,
                  background: '#fff',
                  color: '#214434',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Back to sign in
              </button>
            </form>
          ) : (
            <form noValidate onSubmit={handleAuthSubmit} style={{ display: 'grid', gap: 16 }}>
              {authView === 'register' && (
                <label
                  style={{
                    display: 'grid',
                    gap: 8,
                    fontSize: 13,
                    color: '#214434',
                    fontWeight: 600,
                  }}
                >
                  Name
                  <input
                    value={authForm.name}
                    onChange={(event) => {
                      setAuthForm((current) => ({ ...current, name: event.target.value }))
                      clearAuthFieldError('name')
                    }}
                    aria-invalid={Boolean(authFieldErrors.name)}
                    aria-describedby={authFieldErrors.name ? 'auth-name-error' : undefined}
                    style={{
                      height: 42,
                      borderRadius: 10,
                      border: '1px solid #d2dcd2',
                      padding: '0 12px',
                      fontSize: 15,
                    }}
                  />
                  {authFieldErrors.name && (
                    <small id="auth-name-error" className="field-validation-error" role="alert">
                      {authFieldErrors.name}
                    </small>
                  )}
                </label>
              )}
              <label
                style={{ display: 'grid', gap: 8, fontSize: 13, color: '#214434', fontWeight: 600 }}
              >
                Email
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => {
                    setAuthForm((current) => ({ ...current, email: event.target.value }))
                    clearAuthFieldError('email')
                  }}
                  aria-invalid={Boolean(authFieldErrors.email)}
                  aria-describedby={authFieldErrors.email ? 'auth-email-error' : undefined}
                  style={{
                    height: 42,
                    borderRadius: 10,
                    border: '1px solid #d2dcd2',
                    padding: '0 12px',
                    fontSize: 15,
                  }}
                />
                {authFieldErrors.email && (
                  <small id="auth-email-error" className="field-validation-error" role="alert">
                    {authFieldErrors.email}
                  </small>
                )}
              </label>
              <label
                style={{ display: 'grid', gap: 8, fontSize: 13, color: '#214434', fontWeight: 600 }}
              >
                Password
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => {
                    setAuthForm((current) => ({ ...current, password: event.target.value }))
                    clearAuthFieldError('password')
                  }}
                  aria-invalid={Boolean(authFieldErrors.password)}
                  aria-describedby={authFieldErrors.password ? 'auth-password-error' : undefined}
                  style={{
                    height: 42,
                    borderRadius: 10,
                    border: '1px solid #d2dcd2',
                    padding: '0 12px',
                    fontSize: 15,
                  }}
                />
                {authFieldErrors.password && (
                  <small id="auth-password-error" className="field-validation-error" role="alert">
                    {authFieldErrors.password}
                  </small>
                )}
              </label>
              {authView === 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(authForm.email)
                    setForgotStatus('')
                    setForgotError('')
                    setAuthError('')
                    setAuthFieldErrors({})
                    setAuthView('forgot')
                  }}
                  style={{
                    justifySelf: 'end',
                    padding: 0,
                    color: '#3d6948',
                    background: 'transparent',
                    border: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Forgot password?
                </button>
              )}
              {authView === 'login' && forgotStatus && (
                <div
                  role="status"
                  style={{
                    background: '#edf4ed',
                    color: '#315d3e',
                    border: '1px solid #d4e3d4',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 13,
                  }}
                >
                  {forgotStatus}
                </div>
              )}
              {authError && (
                <div
                  style={{
                    background: '#fde8e8',
                    color: '#7e1f1f',
                    border: '1px solid #f0b4b4',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 14,
                  }}
                >
                  {authError}
                </div>
              )}
              {(authView === 'login' || authView === 'register') && canResendVerification && (
                <button
                  type="button"
                  onClick={() => void handleResendVerification()}
                  disabled={authBusy}
                  style={{
                    justifySelf: 'start',
                    padding: 0,
                    color: '#3d6948',
                    background: 'transparent',
                    border: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: authBusy ? 'not-allowed' : 'pointer',
                  }}
                >
                  Resend verification email
                </button>
              )}
              <button
                type="submit"
                disabled={authBusy}
                style={{
                  height: 46,
                  border: 'none',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #163d2f 0%, #245b41 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: authBusy ? 'not-allowed' : 'pointer',
                  opacity: authBusy ? 0.7 : 1,
                }}
              >
                {authBusy ? 'Please wait…' : authView === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  const visibleDatabases = monitoredDatabases.filter(
    (target) => target.status !== 'REMOVED' && (isAdmin || target.databaseName !== 'dbinsight'),
  )
  const showingNoLiveData =
    healthLoaded &&
    section !== 'Connections' &&
    (selectedDatabaseId === null || !healthScore || healthScore.demoData)
  const dataStatusLabel = !healthLoaded
    ? 'Loading'
    : section === 'Connections'
      ? databaseRegistryLoaded
        ? 'Live registry'
        : 'Loading'
      : healthScore
        ? healthScore.demoData
          ? 'No live data'
          : 'Live metadata'
        : 'No live data'
  const dataStatusTitle =
    section === 'Connections'
      ? 'Connection list is loaded from your account'
      : healthScore && !healthScore.demoData
        ? 'Health score uses live MySQL metadata; other analysis features are not configured'
        : 'No live database metadata is currently available'
  const mainView = !healthLoaded ? (
    <div className="info-banner">
      <Activity size={16} />
      <span>Loading the configured database metadata…</span>
    </div>
  ) : section === 'Connections' ? (
    <LiveConnectionsPage healthScore={healthScore} />
  ) : selectedDatabaseId === null || !healthScore || healthScore.demoData ? (
    <NoLiveDataPage
      title={
        selectedDatabaseId === null ? 'No monitored database selected' : 'Live data unavailable'
      }
      message={
        selectedDatabaseId === null
          ? 'Connect a MySQL database to start live analysis.'
          : (healthError ??
            `DBInsight has no live data for ${selectedDatabaseName}. Demo and sample data are disabled.`)
      }
      onConnections={() => setSection('Connections')}
    />
  ) : section === 'Overview' ? (
    <Overview
      databases={visibleDatabases}
      selectedDatabaseId={selectedDatabaseId}
      onSelectDatabase={setSelectedDatabaseId}
      onConnections={() => setSection('Connections')}
      onNavigate={setSection}
      notify={notify}
      healthScore={healthScore}
      queryTelemetry={queryTelemetry}
      schemaMetadata={schemaMetadata}
      schemaMetadataError={schemaMetadataError}
      alertSummary={alertSummary}
      alertError={alertError}
    />
  ) : section === 'Query performance' ? (
    <LiveQueryPage
      telemetry={queryTelemetry}
      includeInternal={includeInternalQueries}
      onIncludeInternalChange={setIncludeInternalQueries}
    />
  ) : section === 'Schema explorer' ? (
    <LiveSchemaPage
      healthScore={healthScore}
      schemaMetadata={schemaMetadata}
      schemaMetadataError={schemaMetadataError}
    />
  ) : (
    <LiveRecommendationsPage
      response={liveRecommendations}
      error={recommendationError}
      onReviewStatus={async (recommendationId, status) => {
        try {
          await updateRecommendationStatus(recommendationId, status)
          void getLiveRecommendations(selectedDatabaseId ?? undefined)
            .then((result) => {
              setLiveRecommendations(result)
              setRecommendationError(null)
            })
            .catch((error: unknown) => {
              setRecommendationError(
                getApiErrorMessage(error, 'Unable to refresh recommendations.'),
              )
            })
        } catch (error) {
          setRecommendationError(
            getApiErrorMessage(error, 'Unable to update recommendation status.'),
          )
        }
        notify(`Recommendation marked as ${status.toLowerCase().replace(/_/g, ' ')}`)
      }}
    />
  )

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <Database size={19} strokeWidth={2.3} />
          </div>
          <span>
            db<span className="brand-insight">insight</span>
            <sup>AI</sup>
          </span>
          <button
            className="icon-button sidebar-close"
            onClick={() => setMobileNav(false)}
            aria-label="Close menu"
          >
            <X size={17} />
          </button>
        </div>
        <div className="nav-heading">MONITOR</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-link ${section === label ? 'active' : ''}`}
              onClick={() => {
                setSection(label)
                setMobileNav(false)
              }}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {label === 'Recommendations' &&
                healthLoaded &&
                healthScore &&
                !healthScore.demoData &&
                (liveRecommendations?.recommendations.length ?? 0) > 0 && (
                  <span className="nav-count">{liveRecommendations?.recommendations.length}</span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-database">
          <div className="sidebar-db-head">
            <span>DATABASES</span>
            <button
              className="icon-button small"
              onClick={() => setSection('Connections')}
              title="Manage database connections"
            >
              <Plus size={16} />
            </button>
          </div>
          {!databaseRegistryLoaded ? (
            <div className="db-row">
              <span className="status-dot muted" />
              Loading databases
            </div>
          ) : visibleDatabases.length > 0 ? (
            visibleDatabases.map((target) => (
              <button
                key={target.databaseId}
                className={`db-row ${selectedDatabaseId === target.databaseId ? 'selected' : ''}`}
                disabled={target.status !== 'ACTIVE'}
                title={
                  target.status === 'ACTIVE'
                    ? `Select ${target.databaseName}`
                    : 'Pending setup: live monitoring is not connected'
                }
                onClick={() => setSelectedDatabaseId(target.databaseId)}
              >
                <span className={`status-dot ${target.status === 'ACTIVE' ? '' : 'muted'}`} />
                {target.databaseName}
                <span className="db-type">
                  {target.status === 'ACTIVE' ? target.dbType : target.status}
                </span>
              </button>
            ))
          ) : (
            <button className="add-database" onClick={() => setSection('Connections')}>
              <Plus size={14} />
              Add a connection
            </button>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="profile">
            <div className="profile-avatar">
              {authUser?.name?.slice(0, 2).toUpperCase() ?? 'SU'}
            </div>
            <div className="profile-copy">
              <strong>{authUser?.name ?? 'Signed in user'}</strong>
              <span>{authUser?.role ?? 'USER'}</span>
            </div>
            <button
              type="button"
              className="icon-button small"
              onClick={() => setProfileMenuOpen((open) => !open)}
              aria-label="Open account menu"
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
            >
              <Ellipsis size={18} />
            </button>
            {profileMenuOpen && (
              <div className="profile-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false)
                    setShowLogoutConfirmation(true)
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileNav(!mobileNav)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span>Monitor</span>
            <span className="crumb-slash">/</span>
            <strong>{section}</strong>
          </div>
          <div className="topbar-actions">
            <div className="demo-badge" title={dataStatusTitle}>
              <span />
              {dataStatusLabel}
            </div>
            <button
              className="top-icon"
              onClick={() => notify('You are all caught up')}
              title="Notifications"
            >
              <Bell size={18} />
              <i />
            </button>
            <button
              className="help-button"
              onClick={() => notify('DBInsight AI · Project review build')}
            >
              <CircleHelp size={17} />
              <span>Help</span>
            </button>
          </div>
        </header>
        <div className={`page-wrap ${showingNoLiveData ? 'no-live-data-wrap' : ''}`}>
          {mainView}
        </div>
      </main>
      {mobileNav && (
        <button
          className="mobile-scrim"
          aria-label="Close menu"
          onClick={() => setMobileNav(false)}
        />
      )}
      {showLogoutConfirmation && (
        <LogoutConfirmationModal
          onCancel={() => setShowLogoutConfirmation(false)}
          onConfirm={() => {
            setShowLogoutConfirmation(false)
            persistAuthUser(null)
          }}
        />
      )}
      {notice && (
        <div className="toast">
          <Check size={16} />
          {notice}
        </div>
      )}
    </div>
  )
}

export default App
