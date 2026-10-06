import { Body, Controller, Post } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order-dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {

    constructor(private readonly orderService: OrdersService){}

    @Post()
    create (@Body() dto: CreateOrderDto){
        return this.orderService.create(dto);
    }
}
