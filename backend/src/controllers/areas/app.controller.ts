import { Controller, Get } from '@nestjs/common';

@Controller('areas')
export class AreasController {
  @Get()
  getHello(): string {
    return 'hi';
  }
}
