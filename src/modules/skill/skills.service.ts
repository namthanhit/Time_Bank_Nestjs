import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll() {
    // có thể thêm orderBy tuỳ ý
    const data = await this.prisma.skill.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, parent_id: true, name: true, slug: true },
    });
    return { data };
  }
}
