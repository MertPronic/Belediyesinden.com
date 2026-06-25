import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Sağlık kontrolü — yük dengeleyici/izleme için. (globalPrefix nedeniyle /api/health) */
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}
