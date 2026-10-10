# DBInsight AI

An academic project prototype for database health and performance analysis. This repository follows the project-review brief: a React + TypeScript client, a Java/Spring Boot REST API, and a PostgreSQL relational schema based on the supplied ER model.

**MCA DBMS Project Review 1** · Shanmukhi Devi Yadlapalli (26MCA0030) · Guided by Dr. M. Rajkumar

## Current implementation

- Responsive dashboard for overall health, query latency, slow queries, schema metadata, and recommendations.
- Query performance, schema explorer, recommendations, and database connections views.
- Health and schema analysis connect to the selected active MySQL target. Health reports table/index/primary-key coverage; schema analysis reads columns, primary keys, imported foreign keys, and ordered indexes through JDBC metadata.
- Recommendations use local rules by default. Optionally, Google Gemini can generate advisory explanations from bounded schema metadata, findings, and normalized slow-query digests. Suggestions never execute SQL.
- A read-only scheduled collector polls MySQL Performance Schema statement digests for each active target at startup and every 30 seconds.
- The Connections view tests MySQL targets before saving them. Target usernames/passwords are encrypted with AES-256-GCM in a separate credential table and are never returned by the API.
- Each monitored database and its encrypted credentials belong to the account that registered it. Database lists and database-specific analysis endpoints enforce that ownership; administrators can access all registered targets.
- Query digests matching known catalog, session, bootstrap-DDL, and DBInsight metadata patterns are hidden from workload metrics by default. The Query Performance view can include them with a toggle; classification is heuristic because MySQL digest summaries do not identify the originating client.
- PostgreSQL `schema.sql` maps the 11 ER entities to relational tables with primary keys, foreign keys, and uniqueness constraints.
- The health model weights query performance 30%, index health 25%, schema quality 25%, and metadata integrity 20%. Until query telemetry is configured, its score is `null`; the overall score is renormalized across available components and reports partial coverage.

This is an academic prototype, not a production monitoring agent. DBInsight's own users, registrations, encrypted target credentials, snapshots, recommendations, and alerts are stored in PostgreSQL; that application database is not treated as a monitored target. External analysis targets are currently MySQL only and require TLS; PostgreSQL and MariaDB are not supported by the target connector. A successful connection test marks a target active, but query telemetry also requires Performance Schema and the target account must have permission to read its summary tables. Digests are aggregated by MySQL and can reset on server restart. Credentials are encrypted at rest using a deployment-provided key; losing that key makes saved credentials unreadable. Use HTTPS in deployment, a least-privilege MySQL account, and a managed secret store/key-management service for production. Recommendations are advisory and never execute SQL changes.

Database connections registered by older versions were stored under a shared system account. They are not automatically assigned to a user because the original owner cannot be determined; reconnect them while signed in to the account that should own each target.

## Requirements

- Node.js 20.19+ or 22.12+ and npm
- Java 17+
- Maven 3.6+
- PostgreSQL 14+ for DBInsight application storage
- MySQL 8+

## Run the frontend

From the project root:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173`. The dashboard requires the API and a registered MySQL database for live analysis. Without live data, it displays an unavailable or empty state; it does not show sample database data.

## Run the backend

Create a PostgreSQL database/user for DBInsight's application storage, then set the backend environment variables. The defaults target a local `dbinsight` database and `postgres` user; set its password in the environment rather than committing it. MySQL is still required for external databases registered in the Connections view.

```powershell
$env:DBINSIGHT_DB_URL = "jdbc:postgresql://127.0.0.1:5432/dbinsight"
$env:DBINSIGHT_DB_USER = "postgres"
$env:DBINSIGHT_DB_PASSWORD = "your-local-password"
$credentialKey = [Environment]::GetEnvironmentVariable("DBINSIGHT_DATABASE_CREDENTIALS_KEY", "User")
if (-not $credentialKey) {
	$keyBytes = New-Object byte[] 32
	$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
	$rng.GetBytes($keyBytes)
	$credentialKey = [Convert]::ToBase64String($keyBytes)
	[Environment]::SetEnvironmentVariable("DBINSIGHT_DATABASE_CREDENTIALS_KEY", $credentialKey, "User")
	[Array]::Clear($keyBytes, 0, $keyBytes.Length)
	$rng.Dispose()
}
$env:DBINSIGHT_DATABASE_CREDENTIALS_KEY = $credentialKey
cd backend
mvn spring-boot:run
```

The API listens on `http://localhost:8080`. Override `FRONTEND_ORIGIN` if the frontend uses a different origin. The PostgreSQL schema initializer creates the ER-derived tables at startup. For Render, create a PostgreSQL instance and configure the backend with its internal connection details: `DBINSIGHT_DB_URL=jdbc:postgresql://<internal-host>:5432/<database>?sslmode=require`, `DBINSIGHT_DB_USER`, and `DBINSIGHT_DB_PASSWORD`. Render's `DATABASE_URL` uses a `postgres://` URL, so use the JDBC URL format for `DBINSIGHT_DB_URL` rather than copying `DATABASE_URL` unchanged. Keep the generated encryption key private, persistent, and backed up; never commit it. Set it in the backend process environment on every restart. Set `DBINSIGHT_TELEMETRY_INTERVAL_MS` to change the default 30-second polling interval and `DBINSIGHT_SLOW_QUERY_THRESHOLD_MS` to change the default 500 ms slow-query threshold. `/api/health`, `/api/metadata`, `/api/schema/issues`, `/api/queries`, `/api/queries/slow`, and `/api/recommendations` accept an optional `databaseId` and use that target.

To deploy the backend on Render separately from the frontend, create a Web Service from this repository, select **Docker**, and set the Root Directory to `backend` so Render uses `backend/Dockerfile` and builds with the backend as its context. Configure the PostgreSQL and other backend environment variables on the Render service; do not bake credentials into the image.

Swagger UI is available at `/swagger-ui/index.html` and the OpenAPI JSON document at `/v3/api-docs` on the backend host. The API uses a `JSESSIONID` session cookie for signed-in requests. Write operations that require administrative authorization may also require the `X-DBInsight-Token` header unless the signed-in account has the ADMIN role.

Changing the application store from MySQL to PostgreSQL does not automatically copy rows from an existing MySQL deployment. Export and migrate existing users, monitored-target registrations, encrypted credentials, telemetry, recommendations, and alert records separately before switching; keep the same `DBINSIGHT_DATABASE_CREDENTIALS_KEY` so migrated encrypted credentials remain decryptable.

### Optional Gemini-assisted recommendations

Recommendations are rule-based unless Gemini is explicitly enabled. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey), then set the following in the backend PowerShell session before starting Spring Boot:

```powershell
$env:DBINSIGHT_AI_RECOMMENDATIONS_ENABLED = "true"
$env:GEMINI_API_KEY = "your-gemini-api-key"
# Optional; defaults to gemini-3.8-flash.
$env:GEMINI_MODEL = "gemini-3.8-flash"
```

Restart the backend after changing these environment variables. For deployment, set `DBINSIGHT_AI_RECOMMENDATIONS_ENABLED=true`, `GEMINI_API_KEY`, and optionally `GEMINI_MODEL` in the backend service's secret environment settings. Never put the API key in frontend code or commit it. DBInsight calls Gemini through Google's Interactions API and generates recommendations only when the backend has actionable schema or slow-query findings; the response is cached per database for five minutes by default. Set `DBINSIGHT_AI_RECOMMENDATIONS_CACHE_TTL_MS` to change the cache duration. If Gemini is unavailable or misconfigured, DBInsight returns an actionable API error instead of pretending that rule-based suggestions came from AI.

The Gemini API has free usage for some models subject to current model availability and quotas; limits and terms can change. Review your active limits in AI Studio. With unpaid/free Gemini API usage, Google may use submitted content to improve its products and human reviewers may process it. Do not enable this for sensitive, confidential, or personal database metadata. When enabled, DBInsight sends bounded schema metadata, detected findings, and normalized query digests to Google; database credentials and query-result rows are not sent. Use only with data you are authorized to share and after reviewing Google's applicable terms. Recommendations remain advisory and are never executed.

Password reset is disabled by default. To enable Gmail SMTP for local testing, open PowerShell, set the following variables, and start the backend from that same PowerShell window. Replace the example email with the Gmail account that will send the messages:

```powershell
$env:PASSWORD_RESET_ENABLED = "true"
$env:EMAIL_VERIFICATION_ENABLED = "true"
$env:SMTP_HOST = "smtp.gmail.com"
$env:SMTP_PORT = "587"
$env:SMTP_USERNAME = "your-email@gmail.com"
$env:SMTP_AUTH = "true"
$env:SMTP_STARTTLS = "true"
$env:PASSWORD_RESET_FROM = "your-email@gmail.com"
$env:FRONTEND_ORIGIN = "http://localhost:5173"

# Enter your Google App Password when prompted; PowerShell will not display it.
$securePassword = Read-Host "SMTP password / app password" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $env:SMTP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}

cd C:\Users\sivap\Downloads\Project\DBInsight\backend
mvn spring-boot:run
```

For Gmail, use a Google **App Password**, not your regular Gmail password. App Passwords require 2-Step Verification and can be created in your Google Account security settings. These environment variables apply only to the current PowerShell window; set them again when restarting the backend. Keep the App Password private and never commit it. For other SMTP providers, use their server settings instead.

With `EMAIL_VERIFICATION_ENABLED=true`, new registrations receive a verification email and cannot sign in until they use its link. Verification links expire after 24 hours by default; override this with `EMAIL_VERIFICATION_TOKEN_TTL_HOURS`. Existing accounts created before email verification was enabled remain usable. To disable registration verification, set `EMAIL_VERIFICATION_ENABLED=false`; when unset, it follows `PASSWORD_RESET_ENABLED`. Password reset links expire after 30 minutes by default; override the lifetime with `PASSWORD_RESET_TOKEN_TTL_MINUTES`. The password reset API responds generically whether or not the submitted email belongs to an account.

To connect an external target, open **Connections → Connect database** and enter a MySQL database name, host, port, and dedicated read-only account. The target must be reachable from the backend and support TLS. The backend tests the connection before saving encrypted credentials and marking the target active. Health/schema analysis then use that target; Performance Schema query telemetry requires appropriate privileges and Performance Schema enabled on the target.

## REST API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/databases` | List registered monitored databases |
| POST | `/api/databases` | Test and register a MySQL target; requires databaseName, dbType, host, port, username, and password |
| DELETE | `/api/databases/{id}` | Revoke target credentials and stop monitoring; preserves the target record and history, does not drop the MySQL database |
| GET | `/api/metadata?databaseId={id}` | Live tables, columns, primary keys, foreign keys, indexes, and schema findings for a target |
| GET | `/api/queries?databaseId={id}` | Target's latest digest snapshot with availability and collection time |
| GET | `/api/queries/slow` | Latest digests whose average latency exceeds the configured threshold |
| GET | `/api/schema/issues?databaseId={id}` | Target's live missing-primary-key and unsupported-foreign-key-index findings |
| GET | `/api/health?databaseId={id}` | Target's live health score |
| GET | `/api/recommendations?databaseId={id}` | Target's advisory suggestions; never executes SQL |

## Project layout

```text
src/                         React dashboard (Vite + TypeScript)
backend/src/main/java/       Spring Boot API and analysis service
backend/src/main/resources/  PostgreSQL application schema and database configuration
backend/src/test/             Health scoring unit tests
```

When the API reports a live datasource, the dashboard polls query telemetry every 30 seconds and displays measured digests, with an explicit unavailable state when Performance Schema is disabled or has no statements. The application does not substitute sample queries or other demo content when live data is unavailable.