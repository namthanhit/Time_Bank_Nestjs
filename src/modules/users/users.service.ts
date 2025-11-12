import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './typings/create-user.dto';
import { UpdateUserDto } from './typings/user.update.dto';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import e from 'express';
import { UserStatus } from '@prisma/client';
import { console } from 'inspector';
import { RegionService } from '../region/region.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly regionService: RegionService,
  ) {}

  async findAll() {
    return this.prisma.user.findMany();
  }

  async getUserDetailById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) throw new Error('User not found');
    const userDetail = await this.prisma.userDetail.findUnique({
      where: { user_id: id },
    });

    let region;
    if (userDetail?.region_id) {
      region = await this.regionService.getRegionDetail(userDetail.region_id);
    }

    return {
      ...user,
      userDetail,
      region,
    };
  }

  async updateUserById(id: string, dto: UpdateUserDto) {
    const {
      email,
      phone,
      birth_date,
      description,
      work_address,
      study_address,
      social_network,
    } = dto;
    const userData = { email, phone };

    const userDetailData = {
      birth_date,
      description,
      work_address,
      study_address,
      social_network,
    };

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (email) {
      const existingEmailUser = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingEmailUser && existingEmailUser.id !== id) {
        throw new ConflictException('Email already in use');
      }
    }

    if (phone) {
      const existingPhoneUser = await this.prisma.user.findUnique({
        where: { phone },
      });
      if (existingPhoneUser && existingPhoneUser.id !== id) {
        throw new ConflictException('Phone number already in use');
      }
    }

    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: userData,
      }),

      this.prisma.userDetail.upsert({
        where: { user_id: id },
        update: userDetailData,
        create: {
          user_id: id,
          ...userDetailData,
        },
      }),
    ]);
    return updatedUser;
  }

  async blockUserById(userId: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!existingUser) throw new NotFoundException('Not found user');

    await this.prisma.user.update({
      where: {
        id: existingUser.id,
        status: UserStatus.active,
      },
      data: {
        status: UserStatus.banned,
      },
    });

    return { success: true };
  }

  async unblockUserById(userId: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!existingUser) throw new NotFoundException('Not found user');

    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        status: UserStatus.active,
      },
    });

    return { success: true };
  }
}
