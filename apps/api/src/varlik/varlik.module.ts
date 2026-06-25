import { Module } from '@nestjs/common';
import { VarlikController } from './varlik.controller';
import { VarlikService } from './varlik.service';

/** Tenant-scoped varlık modülü. */
@Module({
  controllers: [VarlikController],
  providers: [VarlikService],
})
export class VarlikModule {}
