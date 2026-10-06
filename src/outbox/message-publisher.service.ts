import { Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { DRIZZLE } from '../db/db.module';
import type { Database } from '../db/db.module';
import { outbox } from "src/db/schema";
import { eq } from "drizzle-orm";
import { MessageBrokerService } from "./message-broker.service";

const POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 5000);
const BACH_SIZE = Number(process.env.OUTBOX_BACH_SIZE ?? 10);

@Injectable()

export class OutboxPublisherService {
    private readonly logger = new Logger(OutboxPublisherService.name);
    private draining = false;

    constructor(
        @Inject(DRIZZLE) private readonly db: Database,
        private readonly broker: MessageBrokerService,

    ){}

    @Interval(POLL_INTERVAL_MS)
    async poll() {
        if (this.draining) return;
        this.draining = true;

        try {
            await this.drain()
        } catch (error) {
            this.logger.error('Outbox drain failed', error instanceof Error ? error.stack : error);
        } finally {
            this.draining = false;
        }
    }


    private async drain(){
        await this.db.transaction( async (tx) => {
            const batch = await tx
            .select()
            .from(outbox)
            .where(eq(outbox.status, 'pending'))
            .limit(BACH_SIZE)
            .for('update', { skipLocked: true });

            if (batch.length == 0) return;

            for (const event of batch) {
                try {
                    await this.broker.publish(event.eventType, event.payload, event.id);
                    await tx
                    .update(outbox)
                    .set({ status: 'published', publishedAt: new Date()})
                    .where(eq(outbox.id, event.id));
                } catch (error) {
                    await tx
                    .update(outbox)
                    .set({ lastError: error instanceof Error ? error.message : String(error) })
                    .where(eq(outbox.id, event.id));

                    this.logger.warn(`Publish failed for ${event.id}`)
                }
            }
        })
    }
}