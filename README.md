# rive.

Rive is the operating system for independent work: projects, clients, revenue, expenses, calendar, portfolio, and useful business signals in one connected workspace.

## Local development

Copy `.env.example` to `.env.local`, configure `DATABASE_URL`, then run:

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
