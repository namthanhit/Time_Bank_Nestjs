import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/prisma/prisma.service';

@Injectable()
export class RegionService {
  constructor(private prisma: PrismaService) {}

  // Lấy tất cả tỉnh/thành
  async getProvinces() {
    return this.prisma.region.findMany({
      where: { type: 'province' },
      orderBy: { name: 'asc' },
    });
  }

  // Lấy quận/huyện theo tỉnh
  async getDistricts(provinceId: string) {
    return this.prisma.region.findMany({
      where: { parent_id: provinceId, type: 'district' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        codename: true,
      },
    });
  }

  // Lấy phường/xã theo quận
  async getWards(districtId: string) {
    return this.prisma.region.findMany({
      where: { parent_id: districtId, type: 'ward' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        codename: true,
      },
    });
  }

  // Lấy chi tiết 1 vùng (và parent của nó)
  async getRegionDetail(id: string) {
    const region = await this.prisma.region.findUnique({
      where: { id },
      include: {
        parent: {
          include: {
            parent: true
          }
        },
      },
    });
    if (!region) throw new NotFoundException('Region not found');
    return region;
  }
}
