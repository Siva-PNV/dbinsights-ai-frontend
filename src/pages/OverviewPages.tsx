import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ChevronDown,
  CircleHelp,
  Clock3,
  Command,
  Database,
  Gauge,
  Plus,
  ShieldAlert,
} from 'lucide-react'
import {
  type AlertSummary,
  type HealthScore,
  type LiveSchemaMetadata,
  type MonitoredDatabase,
  type QueryTelemetry,
} from '../api'
import type { Section } from '../types'

export function Overview({
  databases,
  selectedDatabaseId,
  onSelectDatabase,
  onConnections,
  healthScore,
  queryTelemetry,
  schemaMetadata,
  schemaMetadataError,
  alertSummary,
  alertError,
  onNavigate,
  notify,
}: {
  databases: MonitoredDatabase[]
  selectedDatabaseId: number | null
  onSelectDatabase: (databaseId: number) => void
  onConnections: () => void
  healthScore: HealthScore | null
  queryTelemetry: QueryTelemetry | null
  schemaMetadata: LiveSchemaMetadata | null
  schemaMetadataError: string | null
  alertSummary: AlertSummary | null
  alertError: string | null
  onNavigate: (value: Section) => void
  notify: (value: string) => void
}) {
  if (!healthScore || healthScore.demoData) {
    return (
      <NoLiveDataPage
        title="Live data unavailable"
        message="No live database data is available for this selection. Connect a database or try again later."
        onConnections={onConnections}
      />
    )
  }

  if (healthScore.tableCount === 0) {
    return (
      <EmptyDatabaseOverview
        databaseName={healthScore.databaseName}
        databases={databases.filter((target) => target.status !== 'REMOVED')}
        selectedDatabaseId={selectedDatabaseId}
        onSelectDatabase={onSelectDatabase}
      />
    )
  }

  return (
    <LiveOverview
      healthScore={healthScore}
      databases={databases.filter((target) => target.status !== 'REMOVED')}
      selectedDatabaseId={selectedDatabaseId}
      onSelectDatabase={onSelectDatabase}
      queryTelemetry={queryTelemetry}
      schemaMetadata={schemaMetadata}
      schemaMetadataError={schemaMetadataError}
      alertSummary={alertSummary}
      alertError={alertError}
      onNavigate={onNavigate}
      notify={notify}
    />
  )
}

export function EmptyDatabaseOverview({
  databaseName,
  databases,
  selectedDatabaseId,
  onSelectDatabase,
}: {
  databaseName: string
  databases: MonitoredDatabase[]
  selectedDatabaseId: number | null
  onSelectDatabase: (databaseId: number) => void
}) {
  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">
            <span className="live-pulse" />
            LIVE MYSQL ANALYSIS
          </div>
          <h1>
            Database health<span className="title-period">.</span>
          </h1>
          <p className="page-subtitle">Live structural analysis for {databaseName}.</p>
        </div>
      </div>
      <div className="empty-database-controls">
        <DatabasePicker
          databases={databases}
          selectedDatabaseId={selectedDatabaseId}
          onSelectDatabase={onSelectDatabase}
          statusText="Live metadata"
        />
      </div>
      <section className="empty-database-state" aria-live="polite">
        <span className="empty-database-icon">
          <Database size={21} />
        </span>
        <h2>No tables found</h2>
      </section>
    </>
  )
}

export function NoLiveDataPage({
  title,
  message,
  onConnections,
}: {
  title: string
  message: string
  onConnections: () => void
}) {
  return (
    <section className="no-live-data-content" aria-live="polite">
      <span className="empty-database-icon">
        <Database size={21} />
      </span>
      <h1>{title}</h1>
      <p>{message}</p>
      <button className="primary-button" onClick={onConnections}>
        <Plus size={16} />
        Manage connections
      </button>
    </section>
  )
}

export function DatabasePicker({
  databases,
  selectedDatabaseId,
  onSelectDatabase,
  statusText,
}: {
  databases: MonitoredDatabase[]
  selectedDatabaseId: number | null
  onSelectDatabase: (databaseId: number) => void
  statusText?: string
}) {
  const [open, setOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const selectedDatabase = databases.find((target) => target.databaseId === selectedDatabaseId)

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !pickerRef.current?.contains(event.target))
        setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className="database-picker custom-database-picker" ref={pickerRef}>
      <button
        type="button"
        className="database-picker-trigger"
        aria-label="Choose a database"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="db-icon">
          <Database size={15} />
        </span>
        <span className="database-picker-name">
          {selectedDatabase?.databaseName ?? 'Choose database'}
        </span>
        <ChevronDown
          className={`database-picker-chevron ${open ? 'open' : ''}`}
          size={13}
          aria-hidden="true"
        />
        {statusText && <span className="connection-live">{statusText}</span>}
      </button>
      {open && (
        <div className="database-picker-menu" role="listbox" aria-label="Databases">
          {databases.length > 0 ? (
            databases.map((target) => (
              <button
                key={target.databaseId}
                type="button"
                role="option"
                aria-selected={target.databaseId === selectedDatabaseId}
                disabled={target.status !== 'ACTIVE'}
                onClick={() => {
                  onSelectDatabase(target.databaseId)
                  setOpen(false)
                }}
              >
                <span className={`status-dot ${target.status === 'ACTIVE' ? '' : 'muted'}`} />
                <span>{target.databaseName}</span>
                <span className="database-picker-option-status">
                  {target.status === 'ACTIVE' ? target.dbType : target.status}
                </span>
              </button>
            ))
          ) : (
            <span className="database-picker-empty">No registered databases</span>
          )}
        </div>
      )}
    </div>
  )
}

export function LiveOverview({
  healthScore,
  databases,
  selectedDatabaseId,
  onSelectDatabase,
  queryTelemetry,
  schemaMetadata,
  schemaMetadataError,
  alertSummary,
  alertError,
  onNavigate,
  notify,
}: {
  healthScore: HealthScore
  databases: MonitoredDatabase[]
  selectedDatabaseId: number | null
  onSelectDatabase: (databaseId: number) => void
  queryTelemetry: QueryTelemetry | null
  schemaMetadata: LiveSchemaMetadata | null
  schemaMetadataError: string | null
  alertSummary: AlertSummary | null
  alertError: string | null
  onNavigate: (value: Section) => void
  notify: (value: string) => void
}) {
  const telemetryQueries = Array.isArray(queryTelemetry?.queries) ? queryTelemetry.queries : []
  const executionCount = telemetryQueries.reduce((total, item) => total + item.executionCount, 0)
  const averageLatency =
    queryTelemetry?.available && executionCount > 0
      ? telemetryQueries.reduce(
          (total, item) => total + item.avgExecutionMs * item.executionCount,
          0,
        ) / executionCount
      : null
  const slowQueryCount = telemetryQueries.filter((item) => item.status === 'SLOW').length
  const displayedAlerts = alertSummary?.history.slice(0, 2) ?? []
  const [showAllAlerts, setShowAllAlerts] = useState(false)
  const visibleAlerts = showAllAlerts && alertSummary ? alertSummary.history : displayedAlerts
  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">
            <span className="live-pulse" />
            LIVE MYSQL ANALYSIS
          </div>
          <h1>
            Database health<span className="title-period">.</span>
          </h1>
          <p className="page-subtitle">
            Live structural checks and Performance Schema query summaries for{' '}
            {healthScore.databaseName}.
          </p>
        </div>
      </div>
      <div className="overview-controls">
        <DatabasePicker
          databases={databases}
          selectedDatabaseId={selectedDatabaseId}
          onSelectDatabase={onSelectDatabase}
          statusText="Live metadata"
        />
        <span className="updated">
          <span className="tiny-live" />
          Inspected {new Date(healthScore.calculatedAt).toLocaleTimeString()}
        </span>
        <span className="coverage-label">{healthScore.scoreCoveragePercent}% score inputs</span>
      </div>
      {databases.filter((target) => target.status === 'ACTIVE').length < 2 && (
        <p className="database-picker-hint">
          Only one active monitored database is available. Register another under Connections to
          switch between databases.
        </p>
      )}
      <section className="metrics-grid" aria-label="Live database health metrics">
        <article className="metric-card health-card">
          <div className="metric-top">
            <span className="metric-label">OVERALL HEALTH · {healthScore.status}</span>
            <span className="metric-icon health-icon">
              <Gauge size={16} />
            </span>
          </div>
          <div className="health-value-line">
            <strong>{healthScore.overallScore ?? 'N/A'}</strong>
            <span>{healthScore.overallScore == null ? '' : '/ 100'}</span>
            <span className="coverage-label">{healthScore.scoreCoveragePercent}% inputs</span>
          </div>
          <div className="health-track">
            <span style={{ width: `${healthScore.overallScore ?? 0}%` }} />
          </div>
          <div className="metric-foot">
            <span className="health-state">
              <i />
              {healthScore.status}
            </span>
            <span>{healthScore.databaseName}</span>
          </div>
        </article>
        <MetricCard
          label="TABLES INSPECTED"
          value={String(healthScore.tableCount)}
          unit="tables"
          delta="Live"
          detail="JDBC metadata"
          icon={Database}
          good
        />
        <MetricCard
          label="AVG. QUERY LATENCY"
          value={averageLatency === null ? 'N/A' : averageLatency.toFixed(1)}
          unit={averageLatency === null ? 'unavailable' : 'ms'}
          delta={queryTelemetry?.available ? 'Live' : 'No data'}
          detail={
            queryTelemetry?.available
              ? `${executionCount.toLocaleString()} executions in digest summaries`
              : (queryTelemetry?.message ?? 'Waiting for collector')
          }
          icon={Clock3}
          warning={averageLatency === null}
          good={averageLatency !== null}
        />
        <MetricCard
          label="SLOW QUERY DIGESTS"
          value={queryTelemetry?.available ? String(slowQueryCount) : 'N/A'}
          unit="patterns"
          delta={queryTelemetry?.available ? 'Live' : 'No data'}
          detail={
            queryTelemetry?.available
              ? `At or above ${queryTelemetry.slowQueryThresholdMs} ms average`
              : (queryTelemetry?.message ?? 'Waiting for collector')
          }
          icon={Activity}
          warning={slowQueryCount > 0 || !queryTelemetry?.available}
        />
      </section>
      <section className="analysis-grid">
        <article className="panel performance-panel live-empty-panel live-overview-widget">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">QUERY PERFORMANCE</div>
              <h2>
                {queryTelemetry?.available
                  ? 'Highest-impact query patterns'
                  : 'No query telemetry yet'}
              </h2>
            </div>
            <button className="link-button" onClick={() => onNavigate('Query performance')}>
              View details
              <ArrowRight size={14} />
            </button>
          </div>
          {queryTelemetry?.available && telemetryQueries.length > 0 ? (
            <>
              <div className="overview-digest-list">
                {telemetryQueries.slice(0, 3).map((row) => (
                  <div className="overview-digest-row" key={row.digest}>
                    <div className="overview-digest-query">
                      <strong>{row.queryText}</strong>
                      <small>
                        {row.schemaName} · digest {row.digest.slice(0, 8)}
                      </small>
                    </div>
                    <div className="overview-digest-metrics">
                      <span>{row.avgExecutionMs.toFixed(2)} ms avg</span>
                      <span>{row.executionCount.toLocaleString()} calls</span>
                    </div>
                    <span className={`status-pill ${row.status.toLowerCase()}`}>{row.status}</span>
                  </div>
                ))}
              </div>
              <div className="overview-digest-foot">
                Top patterns by total database time · {queryTelemetry.internalQueryCount} internal
                patterns hidden
              </div>
            </>
          ) : (
            <div className="info-banner">
              <Activity size={16} />
              <span>
                {queryTelemetry?.message ?? 'Waiting for the first Performance Schema collection.'}
              </span>
            </div>
          )}
        </article>
        <article className="panel score-panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">LIVE HEALTH BREAKDOWN</div>
              <h2>{healthScore.databaseName}</h2>
            </div>
            <button
              className="icon-button"
              onClick={() =>
                notify(
                  `Query score ${healthScore.queryPerformanceAvailable ? 'uses Performance Schema digest latency' : 'is unavailable because no digests are available'}.`,
                )
              }
              aria-label="Health score information"
            >
              <CircleHelp size={16} />
            </button>
          </div>
          <div className="score-list">
            <ScoreRow
              label="Query performance"
              value={healthScore.queryScore}
              color={healthScore.queryPerformanceAvailable ? 'green' : 'unavailable'}
              detail={
                healthScore.queryPerformanceAvailable
                  ? 'Based on Performance Schema digest latency'
                  : 'No statement digests available'
              }
            />
            <ScoreRow
              label="Index coverage"
              value={healthScore.indexScore}
              color="green"
              detail={`Tables inspected: ${healthScore.tableCount}`}
            />
            <ScoreRow
              label="Primary key coverage"
              value={healthScore.schemaScore}
              color="amber"
              detail={`Tables inspected: ${healthScore.tableCount}`}
            />
            <ScoreRow
              label="Metadata collection"
              value={healthScore.metadataScore}
              color="green"
              detail={`${healthScore.tableCount} tables discovered`}
            />
          </div>
          <button
            className="score-method"
            onClick={() =>
              notify(
                `Weighted score uses ${healthScore.scoreCoveragePercent}% of configured components`,
              )
            }
          >
            <span className="score-method-icon">
              <Command size={14} />
            </span>
            <span>Weighted score · {healthScore.scoreCoveragePercent}% inputs</span>
            <ArrowRight size={14} />
          </button>
        </article>
      </section>
      <section className="lower-grid">
        <article className="panel live-empty-panel live-overview-widget">
          <div className="section-kicker">SCHEMA ANALYSIS</div>
          <h2>
            {schemaMetadata
              ? `${schemaMetadata.issues.length} structural findings`
              : schemaMetadataError
                ? 'Schema scan unavailable'
                : 'Loading schema analysis'}
          </h2>
          <p>
            {schemaMetadata
              ? `${schemaMetadata.tables.length} tables, ${schemaMetadata.tables.reduce((total, table) => total + table.columns.length, 0)} columns, and ${schemaMetadata.tables.reduce((total, table) => total + table.foreignKeys.length, 0)} foreign-key columns inspected.`
              : (schemaMetadataError ??
                'Collecting columns, keys, foreign keys and indexes from JDBC metadata.')}
          </p>
          {schemaMetadata?.issues.slice(0, 2).map((issue) => (
            <div className="schema-alert" key={issue.issueId}>
              <ShieldAlert size={15} />
              <span>
                <strong>{issue.tableName}</strong> · {issue.description}
              </span>
            </div>
          ))}
        </article>
        <article className="panel recommendations-panel live-recommendations-overview">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">ACTIVE ALERTING</div>
              <h2>
                {alertSummary === null
                  ? alertError
                    ? 'Alerts unavailable'
                    : 'Loading alerts'
                  : `${visibleAlerts.length === alertSummary.history.length ? alertSummary.history.length : `${visibleAlerts.length} of ${alertSummary.history.length}`} ${alertSummary.history.length === 1 ? 'recent alert' : 'recent alerts'}`}
              </h2>
            </div>
            <span className="advisory-chip">Monitoring</span>
          </div>
          {visibleAlerts.length ? (
            <div className={`live-issue-list ${showAllAlerts ? 'all-alerts-visible' : ''}`}>
              {visibleAlerts.map((event) => (
                <div className="live-issue-row" key={event.eventId}>
                  <span
                    className={`recommendation-tag ${event.severity === 'HIGH' ? 'coral' : 'amber'}`}
                  >
                    {event.severity}
                  </span>
                  <strong>{event.ruleName}</strong>
                  <span className="issue-type">{event.state}</span>
                  <span>{event.message}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="schema-empty">{alertError ?? 'No alerts have been recorded yet.'}</p>
          )}
          {alertSummary && alertSummary.history.length > 2 && (
            <button
              type="button"
              className="panel-footer-link alert-list-toggle"
              aria-expanded={showAllAlerts}
              onClick={() => setShowAllAlerts((showing) => !showing)}
            >
              {showAllAlerts
                ? 'Show fewer alerts'
                : `Show all ${alertSummary.history.length} alerts`}
              <ChevronDown
                className={showAllAlerts ? 'alert-list-chevron expanded' : 'alert-list-chevron'}
                size={14}
              />
            </button>
          )}
        </article>
      </section>
    </>
  )
}

export function MetricCard({
  label,
  value,
  unit,
  delta,
  detail,
  icon: Icon,
  good = false,
  warning = false,
}: {
  label: string
  value: string
  unit: string
  delta: string
  detail: string
  icon: typeof Gauge
  good?: boolean
  warning?: boolean
}) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <span className={`metric-icon ${warning ? 'warning-icon' : ''}`}>
          <Icon size={16} />
        </span>
      </div>
      <div className="metric-value-line">
        <strong>{value}</strong>
        <span>{unit}</span>
      </div>
      <div className="metric-foot">
        <span className={`metric-delta ${good ? 'good' : warning ? 'warn' : ''}`}>
          {good && <ArrowDownRight size={13} />}
          {delta}
        </span>
        <span>{detail}</span>
      </div>
    </article>
  )
}

export function ScoreRow({
  label,
  value,
  color,
  detail,
}: {
  label: string
  value: number | null
  color: string
  detail: string
}) {
  return (
    <div className="score-row">
      <div className="score-row-top">
        <span>{label}</span>
        <strong>
          {value ?? 'N/A'}
          {value === null ? '' : <small>/100</small>}
        </strong>
      </div>
      <div className="score-track">
        <span
          className={value === null ? 'unavailable' : color}
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
      <span className="score-detail">{detail}</span>
    </div>
  )
}
