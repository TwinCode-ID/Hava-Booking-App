# Required credential rotation

The repository previously tracked production credential files. Adding them to
`.gitignore` protects future commits, but does not remove the values from Git
history or revoke credentials that may already have been copied.

Before releasing these security changes:

1. Rotate the MongoDB database user/password and review database access logs.
2. replace `JWT_SECRET`, which intentionally signs every user out.
3. rotate `OTP_HASH_SECRET` and `UPLOAD_URL_SIGNING_SECRET` with independent,
   randomly generated values of at least 32 bytes.
4. revoke the exposed Google OAuth refresh token and rotate its client secret.
5. delete the exposed Firebase service-account key, create a replacement (or
   use workload identity), and review Firebase audit logs.
6. replace/revoke the exposed Apple Wallet signing certificate/private key and
   passphrase as appropriate in the Apple Developer account.
7. rotate the legacy internal API key even though the application no longer
   uses it.
8. configure the replacement values in the deployment secret manager, using
   `Backend/.env.example` and `Frontend/hava-booking-app/.env.example` only as
   variable-name references.

After rotation, remove these tracked paths from the index and purge them from
all branches/tags in repository history:

- `Backend/.env`
- `Frontend/hava-booking-app/.env`
- `Backend/mypilates-c7465-firebase-adminsdk-fbsvc-332adb77b7.json`
- `Backend/keys/signerKey.pem`
- `Backend/keys/signerKey.p12`
- `Backend/uploads/ProofOfPurchase/`
- `Backend/uploads/UserProfile/`
- `Backend/uploads/Studio/`

History rewriting requires coordination: force-push the cleaned repository,
invalidate old clones/caches, and have every collaborator re-clone. A history
rewrite does not replace credential rotation, because existing clones and
forks may retain the original values.

The upload directories contain runtime customer files and must be moved to
private application storage rather than Git. Run the proof migration in dry-run
mode first (`node scripts/migrateProofUploads.js` from `Backend`), then run it
with `--apply` against a backed-up database/filesystem before untracking the
legacy files. Historical proof links remain short-lived and signed during the
migration window.

The previous cashier UI created some client accounts with one shared default
password. Before release, provide that old value only through the temporary
`LEGACY_CASHIER_PASSWORD` environment variable and run
`node scripts/revokeLegacyCashierPassword.js` from `Backend` in dry-run mode.
After a database backup and user-notification plan, rerun it with `--apply`.
The migration clears the compromised password and passkeys on matching
accounts and increments their authentication version, invalidating existing
sessions. Remove the temporary environment variable immediately afterward;
the script never prints it or account details.

Existing passes also need an immutable student-eligibility snapshot before
release. From `Backend`, run
`node scripts/backfillPassStudentRestriction.js` as a dry-run, review the
`unclassifiable` count, then rerun with `--apply` after a database backup.
Passes whose source package was deleted and whose historical category is not
conclusive remain deliberately blocked from sharing until staff review them.
