import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserDto } from './typings/user.update.dto';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { Prisma, User, UserDetail, UserStatus } from '@prisma/client';
import { RegionService } from '../region/region.service';
import { PaginationRequestDto } from './typings/pagination.dto';
import { getQueryParamsForAdmin } from 'src/utils/get-query-params';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly regionService: RegionService,
  ) {}

  async findAll(userId: string, pagingInfo: PaginationRequestDto) {
    const { queryParams, metadata } = getQueryParamsForAdmin(pagingInfo);
    const where: Prisma.UserWhereInput = {
      NOT: {
        id: 'admin01',
      },
    };

    if (pagingInfo.search) {
      where.OR = [
        { full_name: { contains: pagingInfo.search } },
        { phone: { contains: pagingInfo.search } },
        { id: { contains: pagingInfo.search } },
      ];
    }

    // Status filter
    if (pagingInfo.status) {
      where.status = pagingInfo.status;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: queryParams.paging.skip,
        take: queryParams.paging.take,
        orderBy: queryParams.orderBy || { created_at: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      metadata: {
        ...metadata,
        total,
        totalPages: Math.ceil(total / metadata.pageSize),
      },
    };
  }

  async getMeDetailById(id: string) {
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

  async getUserDetailById(id: string, me: string) {
    const user = await this.prisma.user.findFirst({
      where: { id },
    });
    if (!user) throw new Error('User not found');
    const userDetail = await this.prisma.userDetail.findFirst({
      where: { user_id: id },
    });

    let region;
    if (userDetail?.region_id) {
      region = await this.regionService.getRegionDetail(userDetail.region_id);
    }

    let isFollowing = false;
    const exitstingFollow = await this.prisma.follow.findFirst({
      where: {
        follower_id: me,
        followee_id: id,
      },
    });
    if (exitstingFollow) isFollowing = true;

    return {
      ...user,
      userDetail,
      region,
      isFollowing,
    };
  }

  async updateUserById(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const {
      email,
      phone,
      avatar_url,
      birth_date,
      description,
      address,
      work_address,
      study_address,
      street,
      social_network,
    } = dto;

    const userData = { email, phone, avatar_url };

    const userDetailData = {
      birth_date,
      description,
      address,
      work_address,
      study_address,
      street,
      social_network,
    };

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

    const cleanUserData = Object.fromEntries(
      Object.entries(userData).filter(([_, v]) => v !== undefined),
    );

    const cleanUserDetailData = Object.fromEntries(
      Object.entries(userDetailData).filter(([_, v]) => v !== undefined),
    );

    const transactionOperations: Prisma.PrismaPromise<User | UserDetail>[] = [];
    if (Object.keys(cleanUserData).length > 0) {
      transactionOperations.push(
        this.prisma.user.update({
          where: { id },
          data: cleanUserData,
        }),
      );
    }

    if (Object.keys(cleanUserDetailData).length > 0) {
      transactionOperations.push(
        this.prisma.userDetail.upsert({
          where: { user_id: id },
          update: cleanUserDetailData,
          create: {
            user_id: id,
            ...cleanUserDetailData,
          },
        }),
      );
    }

    if (transactionOperations.length > 0) {
      await this.prisma.$transaction(transactionOperations);
    }
    return { success: true };
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