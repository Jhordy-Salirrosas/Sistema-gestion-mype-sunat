import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentCompany } from '../../../auth/infrastructure/decorators/currentCompanyDecorator';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { SireDashboardHistoryQueryDto } from '../../application/dto/sireDashboardHistoryQueryDto';
import { SireDashboardMetricsService } from '../../application/sireDashboardMetricsService';

@Controller('api/v1/sire/dashboard')
@UseGuards(AuthGuard)
export class SireDashboardMetricsController {
  constructor(private readonly metrics: SireDashboardMetricsService) {}

  @Get('metrics')
  getMetrics(@CurrentCompany() companyId?: string) {
    return this.metrics.getMetrics(companyId);
  }

  @Get('history')
  getHistory(
    @Query() query: SireDashboardHistoryQueryDto,
    @CurrentCompany() companyId?: string,
  ) {
    return this.metrics.getHistory(companyId, query);
  }
}

@Controller('api/v1/sire')
@UseGuards(AuthGuard)
export class SireMetricsCompatibilityController {
  constructor(private readonly metrics: SireDashboardMetricsService) {}

  @Get('metrics')
  getMetrics(@CurrentCompany() companyId?: string) {
    return this.metrics.getMetrics(companyId);
  }
}

@Controller('api/v1/resilience')
@UseGuards(AuthGuard)
export class SireResilienceMetricsCompatibilityController {
  constructor(private readonly metrics: SireDashboardMetricsService) {}

  @Get('metrics')
  getMetrics(@CurrentCompany() companyId?: string) {
    return this.metrics.getMetrics(companyId);
  }

  @Get('history')
  getHistory(
    @Query() query: SireDashboardHistoryQueryDto,
    @CurrentCompany() companyId?: string,
  ) {
    return this.metrics.getHistory(companyId, query);
  }
}

@Controller('api/v1')
@UseGuards(AuthGuard)
export class LegacySireMetricsController {
  constructor(private readonly metrics: SireDashboardMetricsService) {}

  @Get('metrics')
  getMetrics(@CurrentCompany() companyId?: string) {
    return this.metrics.getMetrics(companyId);
  }
}
