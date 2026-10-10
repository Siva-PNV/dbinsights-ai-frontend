import { useState } from 'react'
import { Activity, Braces, Check, Info, LockKeyhole, Table2, TriangleAlert } from 'lucide-react'
import {
  type HealthScore,
  type LiveRecommendation,
  type LiveRecommendationResponse,
  type LiveSchemaMetadata,
  type QueryTelemetry,
} from '../api'

export function LiveQueryPage({
  telemetry,
  includeInternal,
  onIncludeInternalChange,
}: {
  telemetry: QueryTelemetry | null
  includeInternal: boolean
  onIncludeInternalChange: (include: boolean) => void
}) {
  if (!telemetry)
    return (
      <>
        <div className="page-title-row">
          <div>
            <div className="eyebrow">LIVE QUERY ANALYSIS</div>
            <h1>
              Query performance<span className="title-period">.</span>
            </h1>
            <p className="page-subtitle">Waiting for the first Performance Schema collection.</p>
          </div>
        </div>
        <div className="info-banner">
          <Activity size={16} />
          <span>Query digest summaries are collected every 30 seconds.</span>
        </div>
      </>
    )
  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">MYSQL PERFORMANCE SCHEMA</div>
          <h1>
            Query performance<span className="title-period">.</span>
          </h1>
          <p className="page-subtitle">
            {telemetry.message} {telemetry.databaseName ? `Schema: ${telemetry.databaseName}.` : ''}
          </p>
        </div>
        <span className="updated">
          Collected {new Date(telemetry.collectedAt).toLocaleTimeString()}
        </span>
      </div>
      <div className="query-toolbar">
        <label className="include-internal-toggle">
          <input
            type="checkbox"
            checked={includeInternal}
            onChange={(event) => onIncludeInternalChange(event.target.checked)}
          />
          <span>Include internal/system statements</span>
        </label>
        <span className="query-toolbar-note">
          {telemetry.internalQueryCount} internal patterns hidden by default · classification is
          heuristic
        </span>
      </div>
      {telemetry.queries.length > 0 ? (
        <article className="panel full-panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">NORMALIZED STATEMENT DIGESTS</div>
              <h2>{telemetry.queries.length} patterns observed</h2>
            </div>
            <span className="live-pulse" />
          </div>
          <div className="data-table-wrap">
            <table className="data-table wide-table">
              <thead>
                <tr>
                  <th>QUERY DIGEST</th>
                  <th>AVG. TIME</th>
                  <th>EXECUTIONS</th>
                  <th>ROWS EXAMINED</th>
                  <th>ROWS RETURNED</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {telemetry.queries.map((row) => (
                  <tr key={row.digest}>
                    <td>
                      <span className="query-name">{row.queryText}</span>
                      <span className="query-table">
                        {row.schemaName} · digest {row.digest}
                      </span>
                    </td>
                    <td className="mono-cell">{row.avgExecutionMs.toFixed(2)} ms</td>
                    <td className="mono-cell">{row.executionCount.toLocaleString()}</td>
                    <td className="mono-cell">{row.rowsExamined.toLocaleString()}</td>
                    <td className="mono-cell">{row.rowsReturned.toLocaleString()}</td>
                    <td>
                      <span className={`status-pill ${row.status.toLowerCase()}`}>
                        {row.status}
                      </span>
                      {row.internal && <span className="internal-tag">Internal</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : (
        <div className="info-banner">
          <Activity size={16} />
          <span>
            {telemetry.message}{' '}
            {telemetry.internalQueryCount > 0
              ? 'Turn on Include internal/system statements to inspect metadata and DBInsight queries.'
              : 'Execute statements in this schema and ensure Performance Schema is enabled with SELECT access.'}
          </span>
        </div>
      )}
    </>
  )
}

export function LiveSchemaPage({
  healthScore,
  schemaMetadata,
  schemaMetadataError,
}: {
  healthScore: HealthScore
  schemaMetadata: LiveSchemaMetadata | null
  schemaMetadataError: string | null
}) {
  if (!schemaMetadata)
    return (
      <>
        <div className="page-title-row">
          <div>
            <div className="eyebrow">LIVE DATABASE STRUCTURE</div>
            <h1>
              Schema explorer<span className="title-period">.</span>
            </h1>
            <p className="page-subtitle">
              {schemaMetadataError ?? `Collecting JDBC metadata for ${healthScore.databaseName}.`}
            </p>
          </div>
        </div>
        <div className="info-banner">
          <Braces size={16} />
          <span>
            {schemaMetadataError ?? 'Loading columns, primary keys, foreign keys and indexes…'}
          </span>
        </div>
      </>
    )

  const columnCount = schemaMetadata.tables.reduce(
    (total, table) => total + table.columns.length,
    0,
  )
  const foreignKeyCount = schemaMetadata.tables.reduce(
    (total, table) => total + table.foreignKeys.length,
    0,
  )
  const indexCount = schemaMetadata.tables.reduce((total, table) => total + table.indexes.length, 0)

  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">LIVE DATABASE STRUCTURE</div>
          <h1>
            Schema explorer<span className="title-period">.</span>
          </h1>
          <p className="page-subtitle">
            JDBC metadata for {schemaMetadata.databaseName}, collected{' '}
            {new Date(schemaMetadata.collectedAt).toLocaleTimeString()}.
          </p>
        </div>
      </div>
      <div className="query-stats">
        <div>
          <span>TABLES</span>
          <strong>{schemaMetadata.tables.length}</strong>
        </div>
        <div>
          <span>COLUMNS</span>
          <strong>{columnCount}</strong>
        </div>
        <div>
          <span>INDEXES</span>
          <strong>{indexCount}</strong>
        </div>
        <div>
          <span>FOREIGN KEYS</span>
          <strong>{foreignKeyCount}</strong>
        </div>
      </div>
      <div className="live-schema-tables">
        {schemaMetadata.tables.map((table) => {
          const foreignKeyColumns = new Set(table.foreignKeys.map((key) => key.columnName))
          return (
            <article className="panel live-schema-table" key={table.tableName}>
              <div className="panel-heading">
                <div>
                  <div className="section-kicker">TABLE</div>
                  <h2>
                    <Table2 size={15} />
                    {table.tableName}
                  </h2>
                </div>
                <span className="schema-summary">
                  {table.columns.length} columns · {table.indexes.length} indexes ·{' '}
                  {table.foreignKeys.length} foreign keys
                </span>
              </div>
              <div className="schema-live-grid">
                <section>
                  <div className="section-kicker">COLUMNS</div>
                  <div className="column-list">
                    {table.columns.map((column) => (
                      <div key={column.columnName}>
                        <span
                          className={`key-badge ${table.primaryKeyColumns.includes(column.columnName) ? '' : foreignKeyColumns.has(column.columnName) ? 'fk' : ''}`}
                        >
                          {table.primaryKeyColumns.includes(column.columnName)
                            ? 'PK'
                            : foreignKeyColumns.has(column.columnName)
                              ? 'FK'
                              : ''}
                        </span>
                        <strong>{column.columnName}</strong>
                        <small>
                          {column.dataType}
                          {column.nullable ? ' · NULL' : ' · NOT NULL'}
                        </small>
                      </div>
                    ))}
                  </div>
                </section>
                <section>
                  <div className="section-kicker">INDEXES</div>
                  {table.indexes.length ? (
                    <div className="column-list">
                      {table.indexes.map((index) => (
                        <div key={index.indexName}>
                          <span className="key-badge">{index.unique ? 'UQ' : 'IX'}</span>
                          <strong>{index.indexName}</strong>
                          <small>{index.columns.join(', ')}</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="schema-empty">No indexes reported.</p>
                  )}
                  <div className="section-kicker live-foreign-heading">FOREIGN KEYS</div>
                  {table.foreignKeys.length ? (
                    <div className="column-list">
                      {table.foreignKeys.map((key) => (
                        <div key={`${key.constraintName}-${key.sequence}`}>
                          <span className="key-badge fk">FK</span>
                          <strong>{key.columnName}</strong>
                          <small>
                            {key.referencedTable}.{key.referencedColumn}
                          </small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="schema-empty">No foreign keys reported.</p>
                  )}
                </section>
              </div>
            </article>
          )
        })}
      </div>
      <article className="panel live-schema-issues">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">RULE-BASED FINDINGS</div>
            <h2>{schemaMetadata.issues.length} schema issues</h2>
          </div>
          <span className="advisory-chip">Metadata evidence only</span>
        </div>
        {schemaMetadata.issues.length ? (
          <div className="live-issue-list">
            {schemaMetadata.issues.map((issue) => (
              <div className="live-issue-row" key={issue.issueId}>
                <span
                  className={`recommendation-tag ${issue.severity === 'HIGH' ? 'coral' : 'amber'}`}
                >
                  {issue.severity}
                </span>
                <strong>{issue.tableName}</strong>
                <span className="issue-type">{issue.issueType}</span>
                <span>{issue.description}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="info-banner">
            <Check size={16} />
            <span>
              No missing primary keys or foreign keys without a supporting leading-column index were
              detected.
            </span>
          </div>
        )}
      </article>
    </>
  )
}

export function LiveRecommendationsPage({
  response,
  error,
  onReviewStatus,
}: {
  response: LiveRecommendationResponse | null
  error: string | null
  onReviewStatus: (recommendationId: number, status: string) => void
}) {
  const [showAdvisoryInfo, setShowAdvisoryInfo] = useState(false)
  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">
            {!response
              ? 'DATABASE RECOMMENDATIONS'
              : response.source === 'GEMINI'
                ? 'GEMINI-ASSISTED RECOMMENDATIONS'
                : response.source === 'PERSISTED'
                  ? 'SAVED RECOMMENDATIONS'
                  : 'RULE-BASED ADVISORIES'}
          </div>
          <h1>
            Recommendations<span className="title-period">.</span>
          </h1>
          <p className="page-subtitle">
            Suggestions are based on live schema findings and query digests. Review before making
            changes.
          </p>
        </div>
        <div className="advisory-info-wrap">
          <span className="advisory-chip">
            <LockKeyhole size={13} />
            Advisory only
            <button
              type="button"
              className="advisory-info-button"
              aria-label="What does advisory only mean?"
              aria-expanded={showAdvisoryInfo}
              aria-controls="advisory-info"
              onClick={() => setShowAdvisoryInfo((showing) => !showing)}
            >
              <Info size={14} />
            </button>
          </span>
          {showAdvisoryInfo && (
            <div className="advisory-info-popover" id="advisory-info" role="note">
              These are suggestions for you to review. DBInsight does not execute SQL or make
              database changes. Approving or rejecting a suggestion only records your review.
            </div>
          )}
        </div>
      </div>
      {error ? (
        <div className="info-banner">
          <TriangleAlert size={16} />
          <span>{error}</span>
        </div>
      ) : response === null ? (
        <div className="info-banner">
          <Activity size={16} />
          <span>Loading recommendations from live schema and query findings…</span>
        </div>
      ) : (
        <>
          {response.source === 'GEMINI' && (
            <div className="info-banner">
              <Info size={16} />
              <span>
                {response.message} Free Google AI Studio/API usage may be used to improve Google
                products and may be reviewed by people. Do not enable it for sensitive or
                confidential database metadata.
              </span>
            </div>
          )}
          {response.recommendations.length ? (
            <article className="panel live-schema-issues">
              <div className="panel-heading">
                <div>
                  <div className="section-kicker">
                    {response.databaseName} · EVIDENCE-BASED FINDINGS
                  </div>
                  <h2>{response.recommendations.length} suggestions</h2>
                </div>
                <span className="updated">
                  Generated {new Date(response.generatedAt).toLocaleTimeString()}
                </span>
              </div>
              <LiveRecommendationItems
                recommendations={response.recommendations}
                source={response.source}
                onReviewStatus={onReviewStatus}
              />
            </article>
          ) : (
            <article className="panel live-empty-panel">
              <div className="section-kicker">NO MATCHING FINDINGS</div>
              <h2>No recommendations for this scan</h2>
              <p>{response.message}</p>
            </article>
          )}
        </>
      )}
    </>
  )
}

export function LiveRecommendationItems({
  recommendations: liveRecommendations,
  source,
  onReviewStatus,
}: {
  recommendations: LiveRecommendation[]
  source: LiveRecommendationResponse['source']
  onReviewStatus?: (recommendationId: number, status: string) => void
}) {
  return (
    <div className="live-issue-list">
      {liveRecommendations.map((recommendation) => (
        <div className="live-issue-row recommendation-row" key={recommendation.recommendationId}>
          <span
            className={`recommendation-tag ${recommendation.severity === 'HIGH' ? 'coral' : 'amber'}`}
          >
            {recommendation.severity}
          </span>
          <strong>{recommendation.title}</strong>
          <span className="issue-type">
            {recommendation.issueId === null
              ? source === 'GEMINI'
                ? 'AI REVIEW'
                : 'QUERY DIGEST'
              : `ISSUE #${recommendation.issueId}`}
          </span>
          <div className="recommendation-reason">
            <span>{recommendation.reason}</span>
            <small className="recommendation-status">
              {recommendation.status.replace(/_/g, ' ')}
            </small>
            {onReviewStatus && (
              <div className="recommendation-actions">
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => onReviewStatus(recommendation.recommendationId, 'APPROVED')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => onReviewStatus(recommendation.recommendationId, 'REJECTED')}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
