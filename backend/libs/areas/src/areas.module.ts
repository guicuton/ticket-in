import { Module } from '@nestjs/common';
import { AreasService } from './areas.service';

@Module({
  providers: [AreasService],
  exports: [AreasService],
})
export class AreasModule {}
