import { useEffect, useState } from 'react'
import { Activity, Database, LockKeyhole, Plus, Trash2, X } from 'lucide-react'
import {
  getCurrentUser,
  getMonitoredDatabases,
  registerMonitoredDatabase,
  removeMonitoredDatabase,
  type DatabaseRegistration,
  type HealthScore,
  type MonitoredDatabase,
} from '../api'

export function LiveConnectionsPage({ healthScore }: { healthScore: HealthScore | null }) {
  const [databases, setDatabases] = useState<MonitoredDatabase[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [showRegistration, setShowRegistration] = useState(false)
  const [removingDatabaseId, setRemovingDatabaseId] = useState<number | null>(null)
  const [removalError, setRemovalError] = useState('')
  const [registryLoading, setRegistryLoading] = useState(true)
  const [registryError, setRegistryError] = useState('')
  useEffect(() => {
    void getMonitoredDatabases()
      .then((targets) => {
        setDatabases(targets)
        setRegistryError('')
      })
      .catch((error: unknown) => {
        const responseBody = (
          error as { response?: { data?: { detail?: string; message?: string } } }
        ).response?.data
        setRegistryError(
          responseBody?.detail ??
            responseBody?.message ??
            (error instanceof Error ? error.message : 'Unable to load your database connections.'),
        )
      })
      .finally(() => setRegistryLoading(false))
  }, [])
  useEffect(() => {
    void getCurrentUser()
      .then((user) => setIsAdmin(user.role.replace(/^ROLE_/, '').toUpperCase() === 'ADMIN'))
      .catch(() => setIsAdmin(false))
  }, [])
  const saveRegistration = async (registration: DatabaseRegistration) => {
    const created = await registerMonitoredDatabase(registration)
    setDatabases((current) =>
      current.some((target) => target.databaseId === created.databaseId)
        ? current.map((target) => (target.databaseId === created.databaseId ? created : target))
        : [...current, created],
    )
    window.dispatchEvent(new Event('dbinsight-databases-updated'))
  }
  const removeTarget = async (target: MonitoredDatabase) => {
    const confirmed = window.confirm(
      `Remove ${target.databaseName} from DBInsight? Its stored credentials will be revoked. The MySQL database and its data will not be deleted; monitoring history will be retained.`,
    )
    if (!confirmed) return
    setRemovingDatabaseId(target.databaseId)
    setRemovalError('')
    try {
      await removeMonitoredDatabase(target.databaseId)
      setDatabases((current) =>
        current.map((database) =>
          database.databaseId === target.databaseId ? { ...database, status: 'REMOVED' } : database,
        ),
      )
      window.dispatchEvent(new Event('dbinsight-databases-updated'))
    } catch (error) {
      const responseBody = (
        error as { response?: { data?: { detail?: string; message?: string } } }
      ).response?.data
      setRemovalError(
        responseBody?.detail ??
          responseBody?.message ??
          (error instanceof Error ? error.message : 'Unable to remove this database.'),
      )
    } finally {
      setRemovingDatabaseId(null)
    }
  }
  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">MONITORED DATABASES</div>
          <h1>
            Connections<span className="title-period">.</span>
          </h1>
          <p className="page-subtitle">Manage the MySQL sources registered to your account.</p>
        </div>
        <button className="primary-button" onClick={() => setShowRegistration(true)}>
          <Plus size={16} />
          Connect database
        </button>
      </div>
      {isAdmin && healthScore && (
        <article className="panel connection-panel">
          <div className="connection-main">
            <div className="connection-db-icon">
              <Database size={21} />
            </div>
            <div>
              <h2>{healthScore.databaseName}</h2>
              <p>MySQL · DBInsight application datasource</p>
            </div>
            <span className="connection-live">Available</span>
          </div>
          <div className="connection-stats">
            <div>
              <span>TABLES INSPECTED</span>
              <strong>{healthScore.tableCount}</strong>
            </div>
            <div>
              <span>HEALTH STATUS</span>
              <strong>{healthScore.status}</strong>
            </div>
            <div>
              <span>SCORE COVERAGE</span>
              <strong>{healthScore.scoreCoveragePercent}%</strong>
            </div>
          </div>
        </article>
      )}
      {registryError && (
        <div className="registration-error" role="alert">
          {registryError}
        </div>
      )}
      {registryLoading && (
        <div className="info-banner">
          <Activity size={16} />
          <span>Loading your database connections…</span>
        </div>
      )}
      <div className="connection-registry">
        {databases
          .filter((target) => isAdmin || target.databaseName !== 'dbinsight')
          .map((target) => (
            <article className="panel connection-panel" key={target.databaseId}>
              <div className="connection-main">
                <div
                  className={`connection-db-icon ${target.status === 'ACTIVE' ? '' : 'muted-db'}`}
                >
                  <Database size={21} />
                </div>
                <div>
                  <h2>{target.databaseName}</h2>
                  <p>
                    {target.dbType} · {target.host} · database ID {target.databaseId}
                  </p>
                </div>
                <span
                  className={target.status === 'ACTIVE' ? 'connection-live' : 'disconnected-label'}
                >
                  {target.status === 'ACTIVE'
                    ? 'Connected'
                    : target.status === 'REMOVED'
                      ? 'Removed · history retained'
                      : target.status}
                </span>
                {target.status !== 'REMOVED' &&
                  (isAdmin || target.databaseName !== 'dbinsight') && (
                    <button
                      className="icon-button"
                      title="Remove from DBInsight"
                      aria-label={`Remove ${target.databaseName} from DBInsight`}
                      disabled={removingDatabaseId === target.databaseId}
                      onClick={() => void removeTarget(target)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
              </div>
            </article>
          ))}
      </div>
      {!registryLoading &&
        !registryError &&
        databases.filter((target) => isAdmin || target.databaseName !== 'dbinsight').length ===
          0 && (
          <article className="panel live-empty-panel">
            <div className="live-empty-icon" aria-hidden="true">
              <Database size={23} />
            </div>
            <div className="section-kicker">NO CONNECTIONS YET</div>
            <h2>No monitored databases</h2>
            <p>
              Connect a MySQL database to register it to this account and start monitoring. Your
              database credentials stay encrypted by the backend.
            </p>
          </article>
        )}
      {removalError && (
        <div className="registration-error" role="alert">
          {removalError}
        </div>
      )}
      <div className="info-banner connections-note">
        <LockKeyhole size={16} />
        <span>
          Credentials are encrypted by the backend after a successful TLS connection test. Query
          telemetry also requires MySQL Performance Schema and read access to its summary tables.
        </span>
      </div>
      {showRegistration && (
        <DatabaseRegistrationModal
          onClose={() => setShowRegistration(false)}
          onSubmit={saveRegistration}
        />
      )}
    </>
  )
}

export function DatabaseRegistrationModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (registration: DatabaseRegistration) => Promise<void>
}) {
  const [databaseName, setDatabaseName] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<'databaseName' | 'host' | 'port' | 'username' | 'password', string>>
  >({})

  const clearFieldError = (field: 'databaseName' | 'host' | 'port' | 'username' | 'password') => {
    setFieldErrors((current) => {
      if (!(field in current)) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setError('')
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors: typeof fieldErrors = {}
    const normalizedName = databaseName.trim()
    const normalizedHost = host.trim()
    const normalizedPort = Number(port)
    if (!normalizedName) {
      validationErrors.databaseName = 'Database name is required.'
    } else if (!/^[A-Za-z0-9_-]{2,64}$/.test(normalizedName)) {
      validationErrors.databaseName = 'Use 2–64 letters, numbers, underscores, or hyphens.'
    }
    if (!normalizedHost) {
      validationErrors.host = 'Host is required.'
    } else if (
      !/^(localhost|(([0-9]{1,3}\.){3}[0-9]{1,3})|([A-Za-z0-9.-]+))$/.test(normalizedHost)
    ) {
      validationErrors.host = 'Enter a valid hostname, localhost, or IPv4 address.'
    }
    if (!port.trim()) {
      validationErrors.port = 'Port is required.'
    } else if (!/^\d+$/.test(port.trim()) || normalizedPort < 1 || normalizedPort > 65535) {
      validationErrors.port = 'Enter a whole number from 1 to 65535.'
    }
    if (!username.trim()) validationErrors.username = 'Database username is required.'
    if (!password) validationErrors.password = 'Database password is required.'
    setFieldErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setBusy(true)
    setError('')
    try {
      await onSubmit({
        databaseName: normalizedName,
        dbType: 'MYSQL',
        host: normalizedHost,
        port: normalizedPort,
        username,
        password,
      })
      onClose()
    } catch (submitError) {
      const responseBody = (
        submitError as { response?: { data?: { detail?: string; message?: string } } }
      ).response?.data
      setError(
        responseBody?.detail ??
          responseBody?.message ??
          (submitError instanceof Error
            ? submitError.message
            : 'Unable to register this database.'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <section
        className="connect-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-modal-title"
      >
        <div className="modal-top">
          <div className="modal-icon">
            <Database size={19} />
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={busy}
          >
            <X size={18} />
          </button>
        </div>
        <h2 id="registration-modal-title">Connect a MySQL database</h2>
        <p>The backend tests the connection before saving the target.</p>
        <form noValidate onSubmit={submit}>
          <label>
            DATABASE NAME
            <input
              id="registration-database-name"
              name="databaseName"
              placeholder="e.g. app_database"
              value={databaseName}
              onChange={(event) => {
                setDatabaseName(event.target.value)
                clearFieldError('databaseName')
              }}
              aria-invalid={Boolean(fieldErrors.databaseName)}
              aria-describedby={
                fieldErrors.databaseName ? 'registration-database-name-error' : undefined
              }
            />
            {fieldErrors.databaseName && (
              <small
                id="registration-database-name-error"
                className="field-validation-error"
                role="alert"
              >
                {fieldErrors.databaseName}
              </small>
            )}
          </label>
          <div className="form-grid">
            <label>
              HOST
              <input
                id="registration-host"
                name="host"
                placeholder="e.g. db.example.com"
                value={host}
                onChange={(event) => {
                  setHost(event.target.value)
                  clearFieldError('host')
                }}
                aria-invalid={Boolean(fieldErrors.host)}
                aria-describedby={fieldErrors.host ? 'registration-host-error' : undefined}
              />
              {fieldErrors.host && (
                <small id="registration-host-error" className="field-validation-error" role="alert">
                  {fieldErrors.host}
                </small>
              )}
            </label>
            <label>
              PORT
              <input
                id="registration-port"
                type="number"
                placeholder="3306"
                value={port}
                onChange={(event) => {
                  setPort(event.target.value)
                  clearFieldError('port')
                }}
                aria-invalid={Boolean(fieldErrors.port)}
                aria-describedby={fieldErrors.port ? 'registration-port-error' : undefined}
              />
              {fieldErrors.port && (
                <small id="registration-port-error" className="field-validation-error" role="alert">
                  {fieldErrors.port}
                </small>
              )}
            </label>
          </div>
          <label>
            DATABASE USERNAME
            <input
              id="registration-username"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value)
                clearFieldError('username')
              }}
              autoComplete="username"
              aria-invalid={Boolean(fieldErrors.username)}
              aria-describedby={fieldErrors.username ? 'registration-username-error' : undefined}
            />
            {fieldErrors.username && (
              <small
                id="registration-username-error"
                className="field-validation-error"
                role="alert"
              >
                {fieldErrors.username}
              </small>
            )}
          </label>
          <label>
            DATABASE PASSWORD
            <input
              id="registration-password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                clearFieldError('password')
              }}
              autoComplete="new-password"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'registration-password-error' : undefined}
            />
            {fieldErrors.password && (
              <small
                id="registration-password-error"
                className="field-validation-error"
                role="alert"
              >
                {fieldErrors.password}
              </small>
            )}
          </label>
          <div className="demo-notice">
            <LockKeyhole size={15} />
            <span>
              Credentials go to the backend and are encrypted at rest. MySQL TLS is required; failed
              tests are not saved.
            </span>
          </div>
          {error && (
            <div className="registration-error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              <Plus size={15} />
              {busy ? 'Testing connection…' : 'Test and connect'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
