import { jsonb, timestamp } from "drizzle-orm/pg-core";
import { text } from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { numeric } from "drizzle-orm/pg-core";
import { uuid } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";

export const orders = pgTable('orders', {
    id: uuid('id').primaryKey().defaultRandom(),
    customerEmail: text('customer_email').notNull(),
    amount: numeric('amount').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const outboxStatus = pgEnum('outbox_status', ['pending', 'published', 'failed']);

export const outbox = pgTable('outbox', {
    id: uuid('id').primaryKey().defaultRandom(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    status: outboxStatus('status').notNull().default('pending'),
    availableAt: timestamp('available_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    publishedAt: timestamp('published_at'),
    lastError: text('last_error'),
})

export type Order = typeof orders.$inferSelect;
export type OutboxEvent = typeof outbox.$inferSelect;
export type NewOutboxEvent = typeof outbox.$inferInsert;