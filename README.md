# Transactional outbox

NestJS API that creates orders in PostgreSQL and publishes an `order.created` event to Apache Pulsar **without losing consistency** between the database and the broker.

The classic failure is this: if you insert the order and then publish to the message broker, a crash between the two operations leaves a stored order that nobody processed. If you publish first and then insert, consumers can receive an event for an order that does not exist.

The outbox solves that by storing the event in the **same transaction** as the order. A background publisher reads that table and only then talks to Pulsar.

## Flow

1. `POST /orders` opens a transaction and writes to `orders` and `outbox` (`status = pending`).
2. `OutboxPublisherService` polls, locks pending rows with `FOR UPDATE SKIP LOCKED`, and publishes them to Pulsar.
3. On success it marks the event as `published`. On failure it stores the error and retries on the next cycle.
4. `OrderCreatedConsumer` subscribes to the `order.created` topic and records the `eventId` in `processed_events` so the same delivery is not processed twice.

```text
HTTP POST /orders
        │
        ▼
┌───────────────────────────────┐
│  PostgreSQL (one transaction) │
│   orders  +  outbox pending   │
└───────────────┬───────────────┘
                │ poller
                ▼
          Apache Pulsar
           order.created
                │
                ▼
        consumer (idempotent)
```

## Requirements

- Node.js 20+
- Docker Desktop (Postgres 17 and Pulsar 4.1 standalone)

## Getting started

### 1. Environment variables

```bash
cp .env.example .env
```

Default values:

```env
DATABASE_URL=postgres://outbox:outbox@localhost:5445/outbox
PULSAR_URL=pulsar://localhost:6650
PORT=3000
```

### 2. Infrastructure

```bash
docker compose up -d
```

Wait until Pulsar is healthy. Standalone can take a minute or more the first time:

```bash
curl http://localhost:8080/admin/v2/brokers/health
```

It should respond `ok`.

### 3. Dependencies and migrations

```bash
npm install
npx drizzle-kit migrate
```

### 4. API

```bash
npm run start:dev
```

The app listens on `http://localhost:3000`.

## Try it

```bash
curl -X POST http://localhost:3000/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerEmail":"test@example.com","amount":4.23}'
```

In the Nest console you should see, in this order:

1. the created order (HTTP response)
2. `Published order.created: ...` when the poller publishes
3. `Recived order.created ...` when the consumer handles the message

The poller runs every 5 seconds (`OUTBOX_POLL_INTERVAL_MS`).

## Local services

| Service     | Port | Use                                 |
| ----------- | ---- | ----------------------------------- |
| NestJS      | 3000 | API                                 |
| PostgreSQL  | 5445 | orders, outbox, idempotency         |
| Pulsar      | 6650 | binary protocol (client)            |
| Pulsar HTTP | 8080 | admin / health                      |

## If Pulsar does not start

The container keeps BookKeeper metadata. A stop/start of the same container can leave a stale bookie IP, and the process exits with `error code: -10`. Recreate it:

```bash
docker compose stop pulsar
docker compose rm -f pulsar
docker compose up -d pulsar
```

Postgres is left untouched: its data lives in the `outbox_pgdata` volume.
