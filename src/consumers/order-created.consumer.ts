import Pulsar  from 'pulsar-client';
import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PULSAR_CLIENT } from "src/pulsar/pulsar.module";
import { DRIZZLE } from '../db/db.module';
import type { Database } from '../db/db.module';
import { processedEvents } from 'src/db/schema';

const CONSUMER_NAME = 'order-created-consumer';

@Injectable()
export class OrderCreatedConsumer implements OnModuleInit {
    private readonly logger = new Logger(OrderCreatedConsumer.name);
    constructor(
        @Inject(PULSAR_CLIENT) private readonly client: Pulsar.Client,
        @Inject(DRIZZLE) private readonly db: Database
    ){}

    async onModuleInit() {
        await this.client.subscribe({
            topic: 'order.created',
            subscription: 'test-consumer',
            subscriptionType: 'Shared',
            listener: async (msg, consumer) => {
                try {
                    await this.handle(msg);
                } catch (error) {
                    this.logger.error(
                        'Failed to handle message',
                        error instanceof Error? error.stack : error
                    );

                    consumer.negativeAcknowledge(msg);
                }
            },
        });
    }

    async handle(msg: Pulsar.Message) {
        const eventId = msg.getProperties().eventId;
        const payload = JSON.parse(msg.getData().toString());

        await this.db.transaction( async (tx) => {
            const inserted = await tx
            .insert(processedEvents)
            .values({ eventId, consumer: CONSUMER_NAME })
            .onConflictDoNothing()
            .returning();

            if (inserted.length == 0) {
                this.logger.warn(`Skipping duplicate delivery of event ${eventId}`);
                return;
            }
        })
        this.logger.log(
            `Recived order.created (event ${eventId}): ${JSON.stringify(payload)}`
        )
    }
}