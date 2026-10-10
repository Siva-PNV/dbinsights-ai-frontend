import axios from 'axios'

export type HealthScore = {
  queryScore: number | null
  indexScore: number
  schemaScore: number
  metadataScore: number
  overallScore: number | null
  status: string
  calculatedAt: string
  demoData: boolean
  databaseName: string
  tableCount: number
  queryPerformanceAvailable: boolean
  scoreCoveragePercent: number
}

export type MonitoredDatabase = {
  databaseId: number
  databaseName: string
  dbType: string
  status: string
  host: string
}

export type DatabaseRegistration = {
  databaseName: string
  dbType: string
  host: string
  port: number
  username: string
  password: string
}

const client = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ??
    (import.meta.env.DEV
      ? 'http://localhost:8080/api'
      : 'https://dbinsights-ai-intelligence-database.onrender.com/api'),
  timeout: 2500,
  withCredentials: true,
})

export type AuthUser = {
  userId: number
  name: string
  email: string
  role: string
  message: string
}

const adminToken = import.meta.env.VITE_DBINSIGHT_TOKEN ?? 'dbinsight-admin-token'

client.interceptors.request.use((config) => {
  const isWriteOperation = ['post', 'patch', 'put', 'delete'].includes(
    String(config.method ?? '').toLowerCase(),
  )
  const isAuthRequest = config.url?.startsWith('/auth/') ?? false
  if (isWriteOperation && !isAuthRequest) {
    config.headers = config.headers ?? {}
    config.headers['X-DBInsight-Token'] = adminToken
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const responseError = error as {
      config?: { url?: string }
      response?: { status?: number; data?: { detail?: string; message?: string } | null }
    }
    const status = responseError.response?.status
    const isAuthRequest = responseError.config?.url?.startsWith('/auth/') ?? false
    const responseBody = responseError.response?.data
    const hasAuthorizationMessage = Boolean(responseBody?.detail ?? responseBody?.message)
    if (!isAuthRequest && (status === 401 || (status === 403 && !hasAuthorizationMessage))) {
      window.dispatchEvent(new Event('dbinsight-session-expired'))
    }
    return Promise.reject(error)
  },
)

export async function getMonitoredDatabases(): Promise<MonitoredDatabase[]> {
  const response = await client.get<MonitoredDatabase[]>('/databases')
  return response.data
}

export async function registerMonitoredDatabase(
  database: DatabaseRegistration,
): Promise<MonitoredDatabase> {
  const response = await client.post<MonitoredDatabase>('/databases', database)
  return response.data
}

export async function removeMonitoredDatabase(databaseId: number): Promise<void> {
  await client.delete(`/databases/${databaseId}`)
}

export async function getHealthScore(databaseId?: number): Promise<HealthScore> {
  const endpoint = databaseId ? `/databases/${databaseId}/health` : '/health'
  const response = await client.get<HealthScore>(endpoint)
  return response.data
}

export type QuerySummary = {
  queryId: number
  digest: string
  queryText: string
  schemaName: string
  tableName: string
  avgExecutionMs: number
  executionCount: number
  rowsExamined: number
  rowsReturned: number
  status: string
  internal: boolean
}

export type QueryTelemetry = {
  queries: QuerySummary[]
  databaseName: string | null
  available: boolean
  message: string
  collectedAt: string
  slowQueryThresholdMs: number
  internalQueryCount: number
  internalQueriesIncluded: boolean
  demoData: boolean
}

export async function getQueryTelemetry(
  includeInternal = false,
  databaseId?: number,
): Promise<QueryTelemetry> {
  const endpoint = databaseId ? `/databases/${databaseId}/queries` : '/queries'
  const response = await client.get<unknown>(endpoint, { params: { includeInternal } })
  const payload = response.data

  if (Array.isArray(payload)) {
    throw new Error(
      'The backend returned an unsupported query response. Restart Spring Boot to enable live telemetry.',
    )
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    !Array.isArray((payload as QueryTelemetry).queries)
  ) {
    throw new Error('The query telemetry response has an unsupported format.')
  }

  return payload as QueryTelemetry
}

export type LiveSchemaColumn = {
  columnName: string
  dataType: string
  nullable: boolean
  ordinalPosition: number
}

export type LiveForeignKey = {
  constraintName: string
  columnName: string
  referencedTable: string
  referencedColumn: string
  sequence: number
}

export type LiveIndex = {
  indexName: string
  unique: boolean
  columns: string[]
}

export type SchemaIssue = {
  issueId: number
  tableName: string
  issueType: string
  description: string
  severity: string
  status: string
}

export type LiveSchemaTable = {
  tableName: string
  columns: LiveSchemaColumn[]
  primaryKeyColumns: string[]
  foreignKeys: LiveForeignKey[]
  indexes: LiveIndex[]
}

export type LiveSchemaMetadata = {
  databaseName: string
  tables: LiveSchemaTable[]
  issues: SchemaIssue[]
  collectedAt: string
  demoData: boolean
}

export async function getLiveSchemaMetadata(databaseId?: number): Promise<LiveSchemaMetadata> {
  const response = await client.get<unknown>('/metadata', {
    params: databaseId ? { databaseId } : {},
  })
  const payload = response.data
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('The live schema metadata response has an unsupported format.')
  }

  const schema = payload as Partial<LiveSchemaMetadata>
  if (
    typeof schema.databaseName !== 'string' ||
    !Array.isArray(schema.tables) ||
    !Array.isArray(schema.issues) ||
    typeof schema.collectedAt !== 'string' ||
    schema.demoData !== false
  ) {
    throw new Error(
      'The backend is returning the old schema response. Restart Spring Boot to enable live schema analysis.',
    )
  }
  return schema as LiveSchemaMetadata
}

export type LiveRecommendation = {
  recommendationId: number
  issueId: number | null
  title: string
  reason: string
  severity: string
  status: string
}

export type LiveRecommendationResponse = {
  databaseName: string
  recommendations: LiveRecommendation[]
  generatedAt: string
  demoData: boolean
  source: 'GEMINI' | 'RULE_BASED' | 'PERSISTED'
  message: string
}

export async function getLiveRecommendations(
  databaseId?: number,
): Promise<LiveRecommendationResponse> {
  const response = await client.get<unknown>('/recommendations', {
    params: databaseId ? { databaseId } : {},
    timeout: 60_000,
  })
  const payload = response.data
  if (Array.isArray(payload)) {
    throw new Error(
      'The backend returned an unsupported recommendations response. Restart Spring Boot to enable live advisories.',
    )
  }
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !Array.isArray((payload as LiveRecommendationResponse).recommendations) ||
    (payload as LiveRecommendationResponse).demoData !== false ||
    !['GEMINI', 'RULE_BASED', 'PERSISTED'].includes((payload as LiveRecommendationResponse).source)
  ) {
    throw new Error('The live recommendations response has an unsupported format.')
  }
  return payload as LiveRecommendationResponse
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const responseBody = error.response?.data as { detail?: unknown; message?: unknown } | undefined
    if (typeof responseBody?.detail === 'string') return responseBody.detail
    if (typeof responseBody?.message === 'string') return responseBody.message
  }
  return error instanceof Error ? error.message : fallback
}

export type AlertRule = {
  ruleId: number
  ruleName: string
  metric: string
  comparisonOperator: string
  thresholdValue: number
  severity: string
  enabled: boolean
  createdAt: string
}

export type AlertEvent = {
  eventId: number
  ruleName: string
  metric: string
  severity: string
  state: string
  message: string
  metricValue: number
  occurredAt: string
}

export type AlertSummary = {
  rules: AlertRule[]
  history: AlertEvent[]
}

export async function getAlertSummary(): Promise<AlertSummary> {
  const response = await client.get<unknown>('/alerts')
  const payload = response.data
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !Array.isArray((payload as AlertSummary).rules) ||
    !Array.isArray((payload as AlertSummary).history)
  ) {
    throw new Error('The alert summary response has an unsupported format.')
  }
  return payload as AlertSummary
}

export async function updateRecommendationStatus(
  recommendationId: number,
  status: string,
): Promise<LiveRecommendation> {
  const response = await client.patch<LiveRecommendation>(
    `/recommendations/${recommendationId}/status`,
    { status },
  )
  return response.data
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<{
  message: string
  verificationRequired: boolean
  user: AuthUser | null
}> {
  const normalizedEmail = email.trim().toLowerCase()
  const response = await client.post<{
    message: string
    verificationRequired: boolean
    user: AuthUser | null
  }>('/auth/register', { name, email: normalizedEmail, password }, { timeout: 35_000 })
  return response.data
}

export async function loginUser(email: string, password: string): Promise<AuthUser> {
  const normalizedEmail = email.trim().toLowerCase()
  const response = await client.post<AuthUser>('/auth/login', { email: normalizedEmail, password })
  return response.data
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const normalizedEmail = email.trim().toLowerCase()
  const response = await client.post<{ message: string }>(
    '/auth/password/forgot',
    { email: normalizedEmail },
    { timeout: 35_000 },
  )
  return response.data
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  const response = await client.post<{ message: string }>('/auth/password/reset', {
    token,
    password,
  })
  return response.data
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  const response = await client.post<{ message: string }>(
    '/auth/email/verify',
    { token },
    { timeout: 35_000 },
  )
  return response.data
}

export async function resendEmailVerification(email: string): Promise<{ message: string }> {
  const response = await client.post<{ message: string }>(
    '/auth/email/verification/resend',
    { email: email.trim().toLowerCase() },
    { timeout: 35_000 },
  )
  return response.data
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await client.get<AuthUser>('/auth/me')
  return response.data
}

export async function logoutUser(): Promise<void> {
  await client.post('/auth/logout')
}
