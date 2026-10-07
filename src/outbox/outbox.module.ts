import { Module } from "@nestjs/common";
import { MessageBrokerService } from "./message-broker.service";
import { OutboxPublisherService } from "./message-publisher.service";

@Module({
    providers: [MessageBrokerService, OutboxPublisherService]
})

export class OutboxModule{}