# gym-saas backend

Node 20 + Fastify 4 + TypeScript + Prisma 5 + PostgreSQL 16.

## Local development

```bash
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Health: `GET http://localhost:4000/api/v1/health`

## Docker (from repo root)

```bash
docker-compose up --build
```

Runs postgres, the backend (auto-migrates on boot), and a frontend placeholder.

## Seed

```bash
npm run seed
```

Creates: 1 admin + 1 receptionist user, 3 disciplines (Taekwondo/Karate/Boxing), 20 members with contacts, emergency contacts, subscriptions, and payments.
