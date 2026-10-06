import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import type { Database } from '../db/db.module';
import { CreateOrderDto } from './dto/create-order-dto';
import { orders, outbox } from 'src/db/schema';

@Injectable()
export class OrdersService {
    constructor(@Inject(DRIZZLE) private readonly db: Database){}

    async create(dto: CreateOrderDto){
        return this. db.transaction(async (tx) => {
            const [order] = await tx.insert(orders).values({
                customerEmail: dto.customerEmail,
                amount: dto.amount.toFixed(2),
            })
            .returning();

            await tx.insert(outbox).values({
                eventType: 'order.created',
                payload: {
                    orderId: order.id,
                    customerEmail: order.customerEmail,
                    amount: order.amount,
                }
            });

            return order;
        })
    }
}
