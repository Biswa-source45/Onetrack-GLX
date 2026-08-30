# Deployment Readiness & Runbook — Bulk Import Fix Release

Status: **Ready to deploy**, pending the manual checks in Step 0 below.

This covers pushing the fixes described in `QA_Report.docx` to the host and running the
first production bulk import safely. Read it top to bottom before doing anything —
the backup step is not optional.

---

## 0. Before you touch anything

- [ ] **Confirm the host database has never run an import.** This runbook assumes it
      is clean (no `is_imported = true` tenders, no duplicate GeM/RFP identifiers). If
      that assumption is wrong, stop and say so — the fixes in this release correct how
      *new* imports behave, they do not retroactively repair data already written by the
      old, buggy importer. Repairing already-imported production data needs a separate,
      deliberate pass (a corrective migration or a purge-and-reimport), not this runbook.
- [ ] Confirm nobody else is mid-edit on the host app (check with the team) — the deploy
      restarts the backend container, which drops in-flight requests.
- [ ] Have the two source workbooks (`GBX_Tracker_new_final.xlsx`,
      `Tender_Dashboard_26-27.xlsx`) ready on a machine you can upload from.

## 1. Back up the host database first

This is the one step that must happen before any code changes reach the host, no
matter how confident the fix is. Run **on the host**, over SSH:

```bash
# Dump the whole onetrack database to a timestamped file, inside the postgres container
docker exec onetrack-db pg_dump -U postgres -Fc onetrack > onetrack_$(date +%F_%H%M).dump

# Copy it off the host to somewhere durable (your machine, S3, wherever your backups live)
scp <host>:~/onetrack_*.dump ./backups/
```

Verify the dump is real and restorable before moving on — an empty or corrupt backup is
worse than no backup, because it creates false confidence:

```bash
# Sanity check: size should be non-trivial (not a few KB)
ls -lh onetrack_*.dump

# Restore into a throwaway database to prove the dump actually works
docker exec onetrack-db createdb -U postgres onetrack_restore_test
docker exec -i onetrack-db pg_restore -U postgres -d onetrack_restore_test < onetrack_*.dump
docker exec onetrack-db psql -U postgres -d onetrack_restore_test -c "SELECT count(*) FROM bid.bid_workspaces;"
docker exec onetrack-db dropdb -U postgres onetrack_restore_test
```

If you can, also snapshot the Docker volume itself (`postgres_data`) as a second,
independent recovery path — a `pg_dump` won't help if the volume is destroyed outright.

## 2. Audit the host database

Confirms the assumption in Step 0 and shows whether migration 31's unique indexes will
actually be created (it silently skips them if duplicates already exist):

```bash
docker exec onetrack-db psql -U postgres -d onetrack -c "
SELECT count(*) AS imported_tenders FROM bid.bid_workspaces WHERE (metadata->>'imported')::boolean = true;

SELECT UPPER(TRIM(COALESCE(gem_bid_no, bid_no))) AS ident, count(*)
FROM bid.bid_workspaces
WHERE archived_at IS NULL AND COALESCE(gem_bid_no, bid_no) IS NOT NULL
GROUP BY 1 HAVING count(*) > 1;
"
```

Both queries should return zero rows. If the second one doesn't, migration 31 will skip
creating its uniqueness indexes — resolve the duplicates first, or accept that the
importer's own pre-check is the only guard until they're cleaned up.

## 3. Push and let the pipeline build

Nothing manual here — pushing to `main` triggers `.github/workflows/deploy.yml`, which
builds and pushes both Docker images to GHCR.

```bash
git push origin main
```

Watch the Actions tab until both `onetrack-backend` and `onetrack-frontend` builds go
green. Note the commit SHA — it's the image tag you'll pin to if you need to roll back.

## 4. Deploy to the host

Watchtower on the host polls GHCR every 60 seconds and pulls automatically
(`docker-compose.yml`), so in the common case you just wait. To deploy immediately
instead of waiting:

```bash
# On the host
cd /path/to/onetrack
docker compose pull
docker compose up -d
```

## 5. Verify migrations actually ran

The backend applies every pending migration from its embedded SQL files at startup
(`cmd/server/main.go` → `migrations.RunAutoMigrations`) — there is no separate migration
step to run by hand. Confirm it worked:

```bash
docker exec onetrack-db psql -U postgres -d onetrack -c \
  "SELECT version FROM public.onetrack_migrations ORDER BY version DESC LIMIT 6;"

docker logs onetrack-backend --since 5m | grep -i migrat
```

You're looking for the newest migration versions present, and for the log line
`Unique tender identifier indexes created.` — **not** the
`Skipping unique tender identifier indexes: ... duplicate identifier(s) already present`
warning. If you see the warning, the audit in Step 2 missed something; stop and
investigate before importing.

## 6. Confirm the service is healthy

```bash
curl -s http://<host>/health
```

Log in through the UI as `Sadmin` and confirm the Tenders workspace loads (it should be
empty, per the Step 0 assumption).

## 7. Dry-run both workbooks before writing anything

Upload each file from **Bulk Import → dry run** (dry-run is the default; nothing is
written unless you explicitly confirm). Compare the preview counts against the numbers
in `QA_Report.docx`'s Verification section:

| File | Expected "will import" on a clean DB |
|---|---|
| GBX_Tracker_new_final.xlsx | 131 (2 rows skipped as in-sheet duplicates) |
| Tender_Dashboard_26-27.xlsx | 99 (1 row skipped as an in-sheet duplicate) |

If either number is materially different, stop and diff against the QA report before
committing anything — something about the host environment or the file has changed.

## 8. Commit the imports

Import GBX first, then Dashboard (either order is now safe — B8 is fixed — but this
matches the order that was most thoroughly reconciled in QA). After each commit, check
the "SUPPORTING BID sheet — N tenders NOT imported" banner appears if you're importing
`Tender_Dashboard_26-27.xlsx`, and decide separately whether those tenders need to be
added by hand (this importer intentionally does not read that sheet).

## 9. Re-verify against production

Pull the tender list back out and spot-check a handful of tenders against the source
workbook the way the QA pass did — money fields, closing dates, and that
`bid_status = CLOSED` tenders don't carry a fabricated `bid_outcome`. If you have Python
available, the reconciliation approach in the QA pass (compare workbook cells to
`GET /api/v1/bids` output) can be reused directly.

## 10. Rollback plan

If something is wrong after deploying:

1. **Code-only rollback** (no migration was involved or it's backward-compatible):
   pin the previous image tag and redeploy:
   ```bash
   docker compose pull ghcr.io/<owner>/onetrack-backend:<previous-sha>
   docker compose up -d
   ```
2. **Data rollback** (only if a migration needs to be undone, or bad data was
   committed): stop the backend first so nothing writes during the restore, then
   restore from the Step 1 dump:
   ```bash
   docker compose stop backend
   docker exec onetrack-db dropdb -U postgres onetrack
   docker exec onetrack-db createdb -U postgres onetrack
   docker exec -i onetrack-db pg_restore -U postgres -d onetrack < onetrack_<timestamp>.dump
   docker compose start backend
   ```
3. Never run `docker compose down -v` as a rollback shortcut — it deletes the Postgres
   volume along with the containers.

---

## Separate item: rotate the checked-in secrets

Unrelated to this release, but worth doing before or shortly after: `backend/.env` is
committed to the repository with live values for `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, and the `support@globx.co.in` email credentials. Anyone with
repository access — including anyone this repo is ever shared with — has these today.
Recommended: rotate all three values, remove `.env` from version control going forward
(`git rm --cached backend/.env` + a `.gitignore` entry — there currently isn't one), and
inject them at deploy time via `docker-compose.yml` environment variables or a secrets
manager instead. This is a larger, separate change and is not required to ship this
release, but it should not wait indefinitely either.
