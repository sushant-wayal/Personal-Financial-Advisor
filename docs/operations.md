# Operations & Deployment Guide — North Personal Financial Advisor

## Production Architecture

- **Web Hosting**: Vercel (Next.js 16 Serverless/Edge Runtime).
- **Mobile Hosting / Builds**: Expo Application Services (EAS Build / EAS Submit).
- **Database**: Managed PostgreSQL (AWS RDS / Supabase / Neon).
- **Caching & Ephemeral Pub/Sub**: Upstash Redis (Serverless).
- **Scheduled Workflows**: Vercel Cron or GitHub Actions calling `/api/cron`.

---

## Database Migrations

Prisma ORM handles schema migrations.

### Deploying Migrations
During production deployment (`npm run build` executes `prisma migrate deploy && next build`):

```bash
npm run prisma:deploy
```

> [!WARNING]
> Never perform destructive column renames or table drops in production without a backward-compatible phased migration plan.

### Migration Verification
```bash
node scripts/verify-postgres-migration.js
```

---

## Mobile Release Workflow (EAS)

1. Verify production API endpoint:
   ```bash
   npm run check-api-base-url
   ```
2. Build Android APK/AAB:
   ```bash
   cd mobile
   npx eas build --platform android --profile production
   ```
3. Build iOS IPA:
   ```bash
   cd mobile
   npx eas build --platform ios --profile production
   ```

---

## Backup and Disaster Recovery

1. **Database Backups**: Enable continuous WAL archiving or daily automated snapshots on PostgreSQL provider.
2. **Secrets Rotation**: When rotating `AUTH_SECRET`, existing active user sessions will be invalidated and require re-login. Rotating `ADMIN_PASSWORD` takes effect immediately for subsequent logins.
3. **Upstash Redis Outage**: If Redis is unreachable, the system gracefully degrades: real-time streaming progress indicators fall back to standard response completion without crashing the financial advisor loop.

