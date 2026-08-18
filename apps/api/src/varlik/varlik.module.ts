import { Module } from '@nestjs/common';
import { EvrakModule } from '../evrak/evrak.module';
import { VarlikController } from './varlik.controller';
import { VarlikService } from './varlik.service';
import { VarlikGorselService } from './varlik-gorsel.service';

/** Tenant-scoped varlık modülü. */
@Module({
  imports: [EvrakModule],
  controllers: [VarlikController],
  providers: [VarlikService, VarlikGorselService],
  exports: [VarlikService],
})
export class VarlikModule {}
