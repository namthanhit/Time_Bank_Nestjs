import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { RegionService } from './region.service';

@Controller('regions')
export class RegionController {
  constructor(private readonly regionService: RegionService) {}

  @Get('provinces')
  getProvinces() {
    return this.regionService.getProvinces();
  }

  @Get(':provinceId/districts')
  getDistricts(@Param('provinceId') provinceId: string) {
    return this.regionService.getDistricts(provinceId);
  }

  @Get(':districtId/wards')
  getWards(@Param('districtId') districtId: string) {
    return this.regionService.getWards(districtId);
  }

  @Get('detail/:id')
  getRegionDetail(@Param('id') id: string) {
    return this.regionService.getRegionDetail(id);
  }
}
