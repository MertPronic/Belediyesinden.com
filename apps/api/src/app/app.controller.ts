import { Controller, Get } from '@nestjs/common';
import { Unprotected } from 'nest-keycloak-connect';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Sağlık kontrolü — auth'süz erişilebilir. (globalPrefix nedeniyle /api/health) */
  @Get('health')
  @Unprotected()
  getHealth() {
    return this.appService.getHealth();
  }
}
