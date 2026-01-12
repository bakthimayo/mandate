# Migration 008 - Complete Execution Checklist

**RFC-002 v1.2 Domain Identity Migration**  
**Status:** Ready for production execution

---

## 📋 Pre-Execution Phase (2-4 weeks before)

### Understanding & Planning
- [ ] Read RFC-002 v1.2 specification (`docs/RFC-002-v1.2-Organizational-Scope-and-Domain-Identity.md`)
- [ ] Read migration summary (`RFC-002-MIGRATION-SUMMARY.md`)
- [ ] Review governance requirements in AGENTS.md
- [ ] Understand 13 migration phases
- [ ] Review RFC-002 compliance checklist
- [ ] Identify backup storage location
- [ ] Schedule 2-3 hour maintenance window
- [ ] Brief team on migration procedure
- [ ] Prepare rollback procedure (if needed)

### Stakeholder Alignment
- [ ] Engineering lead approval
- [ ] Database team sign-off
- [ ] Operations team briefing
- [ ] Compliance/audit team review
- [ ] Product/business stakeholder notification
- [ ] Customer communication plan (if external)

### Resource Planning
- [ ] Identify primary executor (DBA/DevOps)
- [ ] Identify backup executor
- [ ] Assign verification engineer
- [ ] Schedule on-call availability
- [ ] Reserve 4-6 hours on-call post-execution
- [ ] Plan communication channel (Slack, etc.)

### Testing on Staging
- [ ] Restore staging database from production backup
- [ ] Run pre-migration checks on staging
- [ ] Execute full migration on staging
- [ ] Verify post-migration checks pass
- [ ] Test constraint enforcement
- [ ] Test scope_id prefix validation
- [ ] Verify applications work with updated schema
- [ ] Document any staging issues
- [ ] Get sign-off from testing team

---

## 🔧 Preparation Phase (1-2 days before)

### Database Preparation
- [ ] Verify database connectivity
- [ ] Test backup/restore procedure
- [ ] Confirm backup storage available
- [ ] Check disk space (ensure 150% of DB size free)
- [ ] Verify PostgreSQL version (12+)
- [ ] Check application database connections
- [ ] Review current database size
- [ ] Estimate migration runtime (see timeline table)

### Documentation Review
- [ ] Read MIGRATION-008-README.md completely
- [ ] Read MIGRATION-EXECUTION-GUIDE.md completely
- [ ] Review troubleshooting section
- [ ] Review rollback procedure
- [ ] Understand error messages and recovery
- [ ] Prepare pre-migration validation script
- [ ] Prepare post-migration verification script
- [ ] Print/bookmark key documents

### Communication Setup
- [ ] Create Slack channel for migration coordination
- [ ] Invite all stakeholders
- [ ] Share execution plan document
- [ ] Share timeline estimate
- [ ] Confirm on-call rotations
- [ ] Set up monitoring alerts
- [ ] Test alert notifications

### Service Preparation
- [ ] Document all services using Mandate
- [ ] Document API endpoints that will be affected
- [ ] Prepare service stop scripts
- [ ] Prepare service start scripts
- [ ] Document expected startup time
- [ ] Prepare health check commands
- [ ] Document any custom code interacting with domain_id

---

## ⚡ Execution Day (Morning - Preparation)

### 4 Hours Before Maintenance Window

#### System Checks
- [ ] Verify all systems operational
- [ ] Check application logs for errors
- [ ] Verify database connectivity
- [ ] Check backup job status
- [ ] Verify monitoring/alerting systems
- [ ] Test Slack notifications
- [ ] Check database performance metrics
- [ ] Ensure backups completed successfully

#### Team Preparation
- [ ] All team members on standby
- [ ] Confirm Slack channel access
- [ ] Share timeline and commands one more time
- [ ] Review roles/responsibilities
- [ ] Brief team on known issues
- [ ] Establish communication protocol
- [ ] Set up war room (physical or virtual)

#### Final Pre-Checks
- [ ] Run pre-migration validation on production
  ```
  psql -d mandate < migrations/008_PRE_MIGRATION_CHECKS.sql
  ```
- [ ] Review output - all checks must PASS
- [ ] Document baseline metrics (table sizes, indexes)
- [ ] Note any warnings/issues
- [ ] Get final sign-off from team lead

---

## 🚀 Execution Phase (During Maintenance Window)

### T-30 minutes: Final Notification
- [ ] Send "30 minute warning" to stakeholders
- [ ] Verify team readiness
- [ ] Close any critical support tickets
- [ ] Mute non-critical alerts (if needed)
- [ ] Start recording execution timeline

### T-5 minutes: Service Stop
- [ ] Stop all services writing to Mandate
  ```
  docker-compose down
  # OR systemctl stop mandate-*
  ```
- [ ] Verify services stopped
- [ ] Confirm no open connections to database
  ```
  psql -d mandate -c "SELECT pid, usename FROM pg_stat_activity;"
  ```
- [ ] Wait for in-flight requests to complete (2-5 min)

### T-0: Backup Database
- [ ] Create comprehensive backup
  ```
  BACKUP_FILE="mandate_backup_$(date +%Y%m%d_%H%M%S).sql"
  pg_dump -h localhost -U postgres -F c -b -v -f "$BACKUP_FILE" mandate
  ```
- [ ] Verify backup created successfully
  ```
  ls -lh "$BACKUP_FILE"
  ```
- [ ] Test backup restoration (on staging clone if possible)
  ```
  pg_restore --list "$BACKUP_FILE" | head -20
  ```
- [ ] Document backup file location
- [ ] Store backup in multiple locations

### T+5: Pre-Migration Validation
- [ ] Run pre-migration checks
  ```
  psql -d mandate < migrations/008_PRE_MIGRATION_CHECKS.sql
  ```
- [ ] Review output carefully
- [ ] All checks must PASS (0 errors)
- [ ] Document any warnings
- [ ] If ANY check fails:
  - [ ] STOP execution
  - [ ] Investigate issue
  - [ ] Fix in pre-prod
  - [ ] Reschedule migration

### T+15: Execute Migration
- [ ] Start migration execution
  ```
  echo "Starting migration at $(date)"
  psql -d mandate < migrations/008_rfc002_domain_identity_migration.sql
  echo "Migration completed at $(date)"
  ```
- [ ] Monitor execution progress
- [ ] Watch for any error messages
- [ ] Expected output: BEGIN → COMMIT
- [ ] If error occurs:
  - [ ] Note exact error message
  - [ ] STOP immediately
  - [ ] Restore from backup
  - [ ] Investigate root cause
  - [ ] Reschedule migration

### T+30-60: Post-Migration Validation
- [ ] Run post-migration verification
  ```
  psql -d mandate < migrations/008_POST_MIGRATION_VERIFICATION.sql
  ```
- [ ] Review output line-by-line
- [ ] Verify all checks PASS
- [ ] Confirm:
  - [ ] domain_id columns are gone
  - [ ] scope_id type is TEXT
  - [ ] No NULL domains
  - [ ] scope_id prefix consistency perfect
  - [ ] Historical data intact
  - [ ] Composite indexes created
  - [ ] Triggers active
  - [ ] Foreign keys correct

### T+60: Constraint Testing
- [ ] Test domain slug format constraint
  ```
  psql -d mandate << 'EOF'
  -- This should FAIL
  INSERT INTO domains (organization_id, domain) 
  VALUES ('org-id', 'Bad-Domain');
  EOF
  ```
- [ ] Verify error: "violates check constraint"

- [ ] Test scope_id prefix validation
  ```
  psql -d mandate << 'EOF'
  -- This should FAIL
  INSERT INTO scopes (scope_id, domain, organization_id, owning_team)
  VALUES ('wrong.prod.system', 'finance', 'org-id', 'Team');
  EOF
  ```
- [ ] Verify error: "GOVERNANCE VIOLATION"

- [ ] Test valid scope_id insertion
  ```
  psql -d mandate << 'EOF'
  -- This should SUCCEED
  INSERT INTO scopes (scope_id, domain, organization_id, owning_team)
  VALUES ('finance.prod.system', 'finance', 'org-id', 'Team');
  EOF
  ```

### T+75: Services Restart
- [ ] Verify migration completed successfully
- [ ] Restart all services
  ```
  docker-compose up -d
  # OR systemctl start mandate-*
  ```
- [ ] Monitor service startup logs
- [ ] Verify services healthy
  ```
  docker-compose ps
  # OR systemctl status mandate-*
  ```
- [ ] Allow 2-5 minutes for full startup

---

## ✅ Post-Execution Phase (Verification)

### T+80-100: Smoke Tests
- [ ] API health check
  ```
  curl -s http://localhost:3000/api/health | jq .
  ```
- [ ] Test decisions endpoint
  ```
  curl -s http://localhost:3000/api/decisions | jq . | head -20
  ```
- [ ] Test verdicts endpoint
  ```
  curl -s http://localhost:3000/api/verdicts | jq . | head -20
  ```
- [ ] Test domain-scoped queries
  ```
  curl -s "http://localhost:3000/api/decisions?domain=finance" | jq .
  ```
- [ ] Check application logs
  ```
  tail -f /var/log/mandate/*.log
  ```
- [ ] Verify no error messages
- [ ] Check error rate (should be 0)
- [ ] Monitor CPU/memory (should be normal)

### T+100-120: Comprehensive Verification
- [ ] Review database activity
  ```
  psql -d mandate -c "SELECT * FROM migration_log WHERE migration_version = 8;"
  ```
- [ ] Verify backup archived
  ```
  mv "$BACKUP_FILE" backups/
  ln -s backups/"$BACKUP_FILE" latest_mandate_backup.sql
  ```
- [ ] Document final metrics
  - [ ] Total runtime
  - [ ] Data integrity
  - [ ] No errors logged
  - [ ] Services healthy
- [ ] Create execution report
- [ ] Take screenshots for documentation

### T+120+: Final Sign-Off
- [ ] All checks PASSED
- [ ] No critical errors
- [ ] Services responding normally
- [ ] Logs clean (no domain-related errors)
- [ ] Backup successfully archived
- [ ] Execution report complete
- [ ] Get approval from team lead
- [ ] Send "All clear" notification

---

## 📊 Post-Execution Phase (Follow-Up)

### Immediate (Next 2 hours)
- [ ] Monitor application logs continuously
- [ ] Watch for domain-related errors
- [ ] Test all critical workflows
- [ ] Verify no API contract breaks
- [ ] Keep team on standby
- [ ] Be ready to perform rollback if needed

### Next 24 Hours
- [ ] Monitor application performance
- [ ] Check error rates (should be 0)
- [ ] Verify domain-scoped queries work
- [ ] Test with real-world data patterns
- [ ] Review any alerts or warnings
- [ ] Document any issues found

### Next 1 Week
- [ ] Review all logs for anomalies
- [ ] Update documentation/runbooks
- [ ] Schedule post-mortem meeting
- [ ] Document lessons learned
- [ ] Archive all migration artifacts
- [ ] Celebrate successful governance upgrade!

---

## 🆘 Troubleshooting During Execution

### Pre-checks fail: Check fails with errors
1. [ ] Review each failed check output
2. [ ] Identify root cause (see RFC-002-MIGRATION-SUMMARY.md)
3. [ ] Investigate database state
4. [ ] DO NOT PROCEED with migration
5. [ ] Fix identified issues in pre-prod
6. [ ] Reschedule migration for later

### Migration fails: SQL error during execution
1. [ ] Note exact error message and line number
2. [ ] STOP execution immediately
3. [ ] Restore database from backup
   ```
   psql -d mandate < mandate_backup_*.sql
   ```
4. [ ] Verify restore successful
5. [ ] Investigate root cause
6. [ ] Contact Mandate team
7. [ ] Reschedule migration after fix

### Post-checks fail: Verification shows issues
1. [ ] Review each failed check output
2. [ ] Investigate what went wrong
3. [ ] If reversible: try rollback
4. [ ] If not reversible: restore from backup
5. [ ] Do NOT restart services
6. [ ] Contact Mandate team immediately
7. [ ] Plan corrective migration

### Services won't start: Application startup fails
1. [ ] Check application logs for errors
2. [ ] Verify database connectivity
3. [ ] Check for domain_id hardcoded references
4. [ ] Verify scope_id type conversions in code
5. [ ] May need to rollback if incompatible
6. [ ] Contact development team
7. [ ] Perform rollback if necessary

### Performance degradation: Queries slow after migration
1. [ ] Check new composite indexes created
2. [ ] Run `ANALYZE` on modified tables
3. [ ] Review query execution plans
4. [ ] This is unusual - contact DBA team
5. [ ] Indexes should improve domain queries
6. [ ] May indicate missing data or stats

---

## 📋 Final Verification Checklist

After migration execution, verify ALL of these:

### Database Schema
- [ ] domain_id columns completely removed (verified via query)
- [ ] domain columns are TEXT type (verified via query)
- [ ] domain columns NOT NULL (verified via query)
- [ ] scope_id columns are TEXT type (verified via query)
- [ ] Composite PK on domains: (organization_id, domain)
- [ ] Composite FKs created on 5 tables
- [ ] Composite indexes created (6 total)
- [ ] scope_id validation trigger exists
- [ ] Domain slug format trigger exists

### Data Integrity
- [ ] All verdict events preserved (count matches)
- [ ] All decision events preserved (count matches)
- [ ] All audit entries preserved (count matches)
- [ ] No NULL domains in any table
- [ ] No NULL organization_ids
- [ ] scope_id domain prefix consistency 100%
- [ ] Foreign key references valid
- [ ] No orphaned records

### Governance Compliance
- [ ] RFC-002 Invariant #2 enforced (domain = text)
- [ ] RFC-002 Invariant #3 enforced (scope_id = text)
- [ ] RFC-002 Section 11 compliance (domain_id gone)
- [ ] scope_id prefix validation active
- [ ] Domain slug format validated
- [ ] (organization_id, domain) isolation enforced

### Operational Readiness
- [ ] Services running normally
- [ ] APIs responding correctly
- [ ] No error messages in logs
- [ ] Monitoring alerts clear
- [ ] Backup archived and labeled
- [ ] Migration log entry created
- [ ] Team notified of completion
- [ ] Documentation updated

---

## 🎯 Success Criteria (All must be True)

- [ ] Migration executed without errors (0 SQL errors)
- [ ] All pre-checks passed before migration
- [ ] All post-checks passed after migration
- [ ] domain_id columns completely removed
- [ ] scope_id type successfully converted to TEXT
- [ ] scope_id domain prefix validation working
- [ ] Domain slug format constraint enforced
- [ ] All historical records preserved
- [ ] Services restarted successfully
- [ ] No errors in application logs
- [ ] Smoke tests passed
- [ ] Team sign-off obtained

---

## 📞 Escalation Contacts

If issues arise:

| Issue | Contact | Phone | Email |
|-------|---------|-------|-------|
| SQL errors | DBA On-Call | TBD | TBD |
| Application errors | DevOps On-Call | TBD | TBD |
| Rollback needed | Mandate Lead | TBD | TBD |
| Governance questions | Compliance | TBD | TBD |

---

## 🎉 Completion

When all items checked:

- [ ] Migration is SUCCESSFUL
- [ ] Governance upgrade COMPLETE
- [ ] RFC-002 v1.2 COMPLIANT
- [ ] Production ready and stable

**Congratulations! Migration 008 is complete.**

---

## 📚 Documentation Links

- Migration Summary: `RFC-002-MIGRATION-SUMMARY.md`
- Execution Guide: `MIGRATION-EXECUTION-GUIDE.md`
- Quick Reference: `MIGRATION-008-README.md`
- Pre-Checks: `migrations/008_PRE_MIGRATION_CHECKS.sql`
- Migration SQL: `migrations/008_rfc002_domain_identity_migration.sql`
- Post-Checks: `migrations/008_POST_MIGRATION_VERIFICATION.sql`
- RFC Spec: `docs/RFC-002-v1.2-Organizational-Scope-and-Domain-Identity.md`

---

**Last updated:** 2026-01-07  
**Status:** Production Ready  
**Version:** 1.0
