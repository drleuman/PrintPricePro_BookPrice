# PrintPricePro Marketplace Persistence Deployment Notes

This document certifies the transition from legacy JSON flat-file storage to an industrial MySQL persistence layer.

## 1. Environment Configuration

The following environment variables are required for MySQL persistence:

| Variable | Description | Recommended Value |
|----------|-------------|-------------------|
| `PERSISTENCE_ADAPTER` | The storage backend to use. | `mysql` |
| `MYSQL_HOST` | Database host. | `127.0.0.1` |
| `MYSQL_PORT` | Database port. | `3306` |
| `MYSQL_USER` | Database username. | (Required) |
| `MYSQL_PASSWORD` | Database password. | (Required) |
| `MYSQL_DATABASE` | Database name. | (Required) |

### 2. Operational Verification

#### 2.1 Pre-Deployment Check
Run the following script to verify connectivity and schema readiness:
```bash
node server/scripts/verify-mysql-persistence.js
```

#### 2.2 Migration (JSON to MySQL)
If you have existing data in `server/storage/*.json`, perform the migration:

**Dry Run (Verify counts without writing):**
```bash
node server/scripts/migrate-json-registries-to-mysql.js --dry-run
```

**Real Migration:**
```bash
node server/scripts/migrate-json-registries-to-mysql.js
```
*Note: The migration is idempotent and will skip records already present in MySQL.*

#### 2.3 Smoke Testing
Certify the entire marketplace lifecycle in the target environment:
```bash
PERSISTENCE_ADAPTER=mysql node server/scripts/smoke-test-marketplace-mysql.js
```

## 3. Deployment Safety & Fallback

### 3.1 Idempotent Initialization
The server automatically attempts to initialize the schema on every startup using `CREATE TABLE IF NOT EXISTS`. No manual SQL execution is required for standard deployments.

### 3.2 Rollback Procedure
If MySQL persistence encounters critical issues, you can revert to legacy JSON mode:
1. Change `PERSISTENCE_ADAPTER=json` in `.env`.
2. Restart the server.
3. The server will resume using `server/storage/*.json` as the source of truth.
*Caution: Any data created in MySQL mode will not be automatically synced back to JSON.*

### 3.3 Backup Recommendations
- **JSON**: Backup the `server/storage` directory before migration.
- **MySQL**: Implement standard `mysqldump` backups of the `MYSQL_DATABASE`.

## 4. Certification Checklist
- [ ] `PERSISTENCE_ADAPTER=mysql` set in `.env`.
- [ ] `verify-mysql-persistence.js` returns PASS.
- [ ] `smoke-test-marketplace-mysql.js` returns PASS.
- [ ] Logs show `[MYSQL_CONNECTION_OK]` and `[MYSQL_SCHEMA_READY]` on startup.
- [ ] Health endpoint `/api/admin/health/persistence` reports "UP".
