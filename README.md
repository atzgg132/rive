# rive.

Rive is the operating system for independent work: projects, clients, revenue, expenses, calendar, portfolio, and useful business signals in one connected workspace.

## Local development

Copy `.env.example` to `.env.local`, start the bundled PostgreSQL service, and run the tracked migrations:

```bash
npm install
docker compose up -d db
npm run db:generate
npm run db:migrate
npm run dev
```

For the bundled database, use `DATABASE_URL="postgresql://rive:rive_local@localhost:5432/rive"` in `.env.local`. If Docker is unavailable, use any reachable PostgreSQL 14+ instance with the same migration commands; the app does not silently fall back to an in-memory database.

Open [http://localhost:3000](http://localhost:3000).

For the open-beta signup flow, keep `EMAIL_PROVIDER="console"` during local development. Registering an account prints the email-verification link in the server terminal. See [`docs/open-beta-local-testing.md`](docs/open-beta-local-testing.md) for the complete smoke-test checklist, including admin funnel and invoice PDF checks.

For a local session against the AWS development database, authenticate with the AWS CLI once and use the SSM tunnel commands below. The tunnel keeps the development URL in process memory and does not write it to `.env.local`:

```bash
aws login
npm run db:migrate:status:aws
npm run db:migrate:aws
npm run dev:aws
```

## Production deployment

Production runs on AWS in `ap-south-1`. The `dev`, `test`, and `main` branches deploy to isolated AWS environments through GitHub Actions after the quality gate passes. Infrastructure, secrets, migrations, and deployment details live in [`infrastructure/README.md`](infrastructure/README.md).

The production build validates TypeScript, and database migrations run as part of the AWS deployment process. Email configuration is documented in `.env.example`.

## Useful commands

```bash
npm run lint
npm run test:e2e
npm run build
npm run check
```

## Deployment policy

Vercel is not part of the production deployment path. Use the AWS workflow for every environment and treat `main` as production.
