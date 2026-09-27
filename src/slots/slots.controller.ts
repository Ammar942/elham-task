import { Controller, Get } from '@nestjs/common';
import { ApiInternalServerErrorResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ErrorResponse, SlotListResponse } from '../docs/schemas';
import { SlotsService } from './slots.service';

@ApiTags('slots')
@Controller('slots')
export class SlotsController {
  constructor(private readonly slots: SlotsService) {}

  @Get()
  @ApiOperation({
    summary: 'List available slots',
    description: 'Returns slots without an active booking, sorted by startsAt then id. No parameters, no request body.',
  })
  @ApiOkResponse({ type: SlotListResponse })
  @ApiInternalServerErrorResponse({ type: ErrorResponse, description: 'INTERNAL_ERROR' })
  async list() {
    return { slots: await this.slots.listAvailable() };
  }
}
