import { Module } from "@nestjs/common";
import { MessageBrokerService } from "./message-broker.service";

@Module({
    providers: [MessageBrokerService]
})

export class OutboxModule{}