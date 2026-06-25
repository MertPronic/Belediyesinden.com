import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { sharedDataSourceOptions } from '@belediyesinden/db';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // TypeORM: shared schema. migrationsRun=true → startup'ta shared migration'ları
    // çalıştırır (tenants/users/audit_log tabloları + append-only trigger oluşturur).
    TypeOrmModule.forRoot({
      ...sharedDataSourceOptions,
      migrationsRun: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
