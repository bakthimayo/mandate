# Migration 008 Execution Guide

**Quick Reference for Running RFC-002 Domain Identity Migration**

---

## Pre-Execution (1 hour before maintenance window)

### 1. Stop All Services

```bash
# Stop all services writing to Mandate database
docker-compose down
# OR
systemctl stop mandate-*
# OR
kill <process-ids>
```

### 2. Create Backup

```bash
# Backup database (CRITICAL - DO NOT SKIP)
BACKUP_FILE="mandate_backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump -h localhost -U postgres -F c -b -v -f "$BACKUP_FILE" mandate

# Verify backup
pg_restore --list "$BACKUP_FILE" | head -20
ls -lh "$BACKUP_FILE"
```

### 3. Verify Test Environment

```bash
# Test on STAGING first
psql -h staging-db -U postgres mandate < migrations/008_PRE_MIGRATION_CHECKS.sql

# Check output for all PASSes and 0 errors
```

---

## Execution (During Maintenance Window)

### 4. Run Pre-Migration Checks (5 min)

```bash
psql -h localhost -U postgres mandate < migrations/008_PRE_MIGRATION_CHECKS.sql
```

**Expected output:**
```
=== CHECK 1: Domain Data Availability ===
domains table row count: <count>
domain_id NULL count: 0
name (future domain) NULL count: 0

=== CHECK 2: Orphaned Foreign Keys ===
scopes.domain_id -> domains.domain_id orphans: 0
policy_snapshots.domain_id -> domains.domain_id orphans: 0
... (all should be 0)

=== MIGRATION READINESS SUMMARY ===
If all "result" values are 0 (except for row counts), migration is SAFE to proceed.
```

**If ANY check fails:** STOP and investigate before proceeding

### 5. Run Migration (5-30 min depending on data size)

```bash
echo "Starting RFC-002 Domain Identity Migration..."
start_time=$(date +%s)

psql -h localhost -U postgres mandate < migrations/008_rfc002_domain_identity_migration.sql

end_time=$(date +%s)
elapsed=$((end_time - start_time))

echo "Migration completed in $elapsed seconds"
```

**Expected output:**
```
BEGIN
SET
UPDATE <N> (scopes.domain backfill)
UPDATE <N> (policy_snapshots.domain backfill)
... (multiple UPDATE statements)
... (multiple ALTER TABLE statements)
... (CREATE FUNCTION, CREATE TRIGGER statements)
... (CREATE INDEX statements)
INSERT 1 (migration_log)
COMMIT
```

**If ANY error appears:** DO NOT CONTINUE - Check error, restore backup if critical

### 6. Run Post-Migration Verification (5-10 min)

```bash
psql -h localhost -U postgres mandate < migrations/008_POST_MIGRATION_VERIFICATION.sql
```

**Expected output:**
```
=== VERIFICATION 1: domain_id Column Removal ===
Remaining domain_id columns in mandate schema: 0

=== VERIFICATION 2: Domain Column Configuration ===
table_name | data_type
scopes | text
policy_snapshots | text
... (all text)

=== VERIFICATION 3: scope_id Type Conversion ===
data_type: text

=== VERIFICATION 4: scope_id Domain Prefix Consistency ===
scopes_with_domain_prefix_match: <count>
scopes_with_domain_prefix_mismatch: 0

... (all similar verification checks)
```

**All checks should show PASS or 0 for error counts.**

---

## Post-Execution (Verify System)

### 7. Test Constraints

```bash
# Test domain slug format constraint
psql -h localhost -U postgres mandate << 'EOF'
-- This should succeed
INSERT INTO domains (organization_id, domain)
VALUES ('00000000-0000-0000-0000-000000000001', 'test-domain');
-- Expected: INSERT 1

-- This should FAIL (uppercase not allowed)
INSERT INTO domains (organization_id, domain)
VALUES ('00000000-0000-0000-0000-000000000001', 'TEST-DOMAIN');
-- Expected: ERROR: new row for relation "domains" violates check constraint
EOF
```

### 8. Test scope_id Prefix Validation

```bash
psql -h localhost -U postgres mandate << 'EOF'
-- This should succeed
INSERT INTO scopes (scope_id, domain, organization_id, owning_team)
VALUES ('test-domain.prod.service.agent', 'test-domain', 
        '00000000-0000-0000-0000-000000000001', 'Team');
-- Expected: INSERT 1

-- This should FAIL (domain prefix mismatch)
INSERT INTO scopes (scope_id, domain, organization_id, owning_team)
VALUES ('wrong-domain.prod.service.agent', 'test-domain',
        '00000000-0000-0000-0000-000000000001', 'Team');
-- Expected: ERROR: GOVERNANCE VIOLATION: scope_id ... does not embed domain prefix ...
EOF
```

### 9. Restart Services

```bash
# Restart all Mandate services
docker-compose up -d
# OR
systemctl start mandate-*
```

### 10. Smoke Tests (10-15 min)

```bash
# Test API endpoints
curl -s http://localhost:3000/api/decisions | jq . | head -20
curl -s http://localhost:3000/api/verdicts | jq . | head -20

# Verify domain filtering works
curl -s "http://localhost:3000/api/decisions?domain=finance" | jq .

# Check application logs
tail -f /var/log/mandate/*.log

# Monitor for errors
grep -i "error\|exception\|fail" /var/log/mandate/*.log | head -20
```

### 11. Document Completion

```bash
# Record migration details
cat > migration_008_execution_log.txt << EOF
Migration: 008 - RFC-002 Domain Identity
Executed: $(date)
Duration: $elapsed seconds
Backup: $BACKUP_FILE
Pre-checks: PASSED
Migration: SUCCESS
Post-checks: PASSED
Tests: PASSED
Services: RESTARTED
Status: COMPLETE

Domain ID columns removed: $(psql -h localhost -U postgres mandate -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE column_name = 'domain_id' AND table_schema = 'mandate';")
scope_id TEXT columns: $(psql -h localhost -U postgres mandate -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'scopes' AND column_name = 'scope_id' AND data_type = 'text';")
EOF

# Archive backup
mv "$BACKUP_FILE" backups/
ln -s backups/"$BACKUP_FILE" latest_mandate_backup.sql
```

---

## Troubleshooting

### Pre-checks fail: "NULL count" errors

```bash
# Identify missing data
psql -h localhost -U postgres mandate << 'EOF'
SELECT table_name, COUNT(*) as null_count
FROM information_schema.columns
WHERE table_name IN ('domains', 'scopes', 'policy_snapshots', 'decision_events')
  AND column_name IN ('domain', 'domain_id')
  AND is_nullable = 'YES'
GROUP BY table_name;

-- Check domains.name for NULLs
SELECT COUNT(*) FROM domains WHERE name IS NULL;

-- Check for orphaned foreign keys
SELECT COUNT(*) FROM scopes WHERE domain_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM domains WHERE domain_id = scopes.domain_id);
EOF
```

**Fix:** Backfill missing data, retry pre-checks

### Migration fails with constraint error

```bash
# Identify problematic data
psql -h localhost -U postgres mandate << 'EOF'
-- Check domain name format
SELECT name FROM domains WHERE name !~ '^[a-z0-9_-]+$';

-- Check for duplicate domain names
SELECT organization_id, name, COUNT(*) 
FROM domains GROUP BY organization_id, name HAVING COUNT(*) > 1;
EOF
```

**Fix:** Clean data, retry migration

### Post-checks fail

```bash
# Check what went wrong
psql -h localhost -U postgres mandate << 'EOF'
-- Verify domain_id is completely gone
SELECT * FROM information_schema.columns 
WHERE column_name = 'domain_id' AND table_schema = 'mandate';

-- Verify scope_id is TEXT
SELECT data_type FROM information_schema.columns
WHERE table_name = 'scopes' AND column_name = 'scope_id';

-- Check migration log
SELECT * FROM migration_log WHERE migration_version = 8;
EOF
```

**Fix:** Review migration output, check logs, restore backup if needed

### scope_id Validation Trigger causes INSERT to fail

```
ERROR: GOVERNANCE VIOLATION: scope_id 'logistics.prod.system' 
does not embed domain prefix 'finance'
```

**Fix:** Ensure scope_id starts with domain prefix:

```sql
-- BAD (mismatch)
INSERT INTO scopes (scope_id, domain, ...) 
VALUES ('logistics.prod.service', 'finance', ...);

-- GOOD (domain prefix correct)
INSERT INTO scopes (scope_id, domain, ...) 
VALUES ('finance.prod.service', 'finance', ...);
```

### Performance: Migration is slow

Large datasets (>1M records) may take 30+ minutes. This is normal.

```bash
# Monitor progress
watch -n 5 'psql -h localhost -U postgres mandate -c "
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del 
FROM pg_stat_user_tables 
WHERE tablename IN ('"'"'scopes'"'"', '"'"'verdict_events'"'"');"'
```

---

## Rollback Procedure

If migration fails critically:

```bash
# 1. Stop services immediately
docker-compose down

# 2. Restore database from backup
pg_restore -h localhost -U postgres -d mandate --clean --if-exists "$BACKUP_FILE"

# 3. Verify restore
psql -h localhost -U postgres mandate -c "SELECT COUNT(*) FROM scopes;"

# 4. Restart services
docker-compose up -d

# 5. Notify team
echo "Migration 008 rolled back. Investigation required." | \
  mail -s "URGENT: Migration 008 Rollback" team@company.com
```

---

## Verification Checklist (Post-Execution)

- [ ] Pre-checks passed (all 0s/expected counts)
- [ ] Migration ran without errors
- [ ] Post-checks passed (all 0s/expected counts)
- [ ] domain_id columns completely gone
- [ ] scope_id type is TEXT
- [ ] No NULL domains
- [ ] scope_id domain prefix validation working
- [ ] Domain format constraint enforced
- [ ] Services restarted successfully
- [ ] API endpoints responding
- [ ] No application errors in logs
- [ ] Sample inserts tested
- [ ] Backup archived and labeled
- [ ] Execution log documented

---

## Timeline Summary

| Step | Time | Critical |
|---|---|---|
| Pre-execution setup | 15 min | ⚠️  |
| Services stop | 5 min | Yes |
| Database backup | 10-60 min | **YES** |
| Pre-migration checks | 5 min | Yes |
| Migration execution | 5-30 min | Yes |
| Post-migration checks | 5-10 min | Yes |
| Constraint testing | 5 min | Yes |
| Services restart | 5 min | Yes |
| Smoke tests | 15 min | ⚠️  |
| **TOTAL** | **60-150 min** | **CRITICAL** |

**Schedule 2+ hour maintenance window for safety buffer.**

---

## Success Criteria

Migration is successful when:

1. ✅ All pre-checks PASS
2. ✅ Migration runs without errors
3. ✅ All post-checks PASS  
4. ✅ Constraint tests succeed/fail as expected
5. ✅ Services restart cleanly
6. ✅ APIs respond normally
7. ✅ No errors in application logs
8. ✅ Database backups archived

---

## Support Contact

**During Migration:**
- Check error messages carefully
- Review migration summary PDF
- Contact Mandate team on Slack

**After Migration:**
- Monitor logs for domain-related errors
- Test domain-scoped API calls
- Update documentation/runbooks
- Schedule post-mortem if issues found

---

**Ready to execute. Backup database before starting.**
