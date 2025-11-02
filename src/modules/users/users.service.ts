import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './typings/create-user.dto';
import { UpdateUserDto } from './typings/user.update.dto';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import e from 'express';
import { UserStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      ...user,
      userDetail,
    };
  }

  async updateUserById(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) throw new Error('User not found');

    const existingEmailUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmailUser && existingEmailUser.id !== id) {
      throw new Error('Email already in use');
    }

    const existingPhoneUser = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existingPhoneUser && existingPhoneUser.id !== id) {
      throw new Error('Phone number already in use');
    }

    //tạo transaction
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          phone: dto.phone,
          email: dto.email,
        },
      });

      let userDetail = await tx.userDetail.findUnique({
        where: { user_id: id },
      });

      if (userDetail) {
        await tx.userDetail.update({
          where: { user_id: id },
          data: {
            birth_date: dto.birth_date,
            description: dto.description,
            //address: dto.address,
            work_address: dto.work_address,
            study_address: dto.study_address,
            social_network: dto.social_network,
          },
        });
      }
    });
    return result;
  }

  async blockUserById(userId: string) {
    const existingUser = this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!existingUser) throw new NotFoundException("Not found user")

    await this.prisma.user.update({
      where: {
        id: userId,
        status: UserStatus.active
      },
      data: {
        status: UserStatus.banned
      }
    })

    return { success: true }
  }
}
