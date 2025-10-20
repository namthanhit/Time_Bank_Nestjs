import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './typings/create-user.dto';
import { UpdateUserDto } from './typings/user.update.dto';
import { PrismaService } from 'src/infra/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // //để tạm thời để fake user
  // async create(data: CreateUserDto) {
  //   return this.prisma.user.create({
  //     data: {
  //       full_name: data.full_name,
  //       citizen_id: data.citizen_id,
  //       phone: data.phone,
  //       email: data.email,
  //       qr_code: data.qr_code ?? `QR-${Date.now()}`
  //     },
  //   });
  // }

  async findAll() {
    return this.prisma.user.findMany();
  }

  async getUserDetailById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) throw new Error("User not found");
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

    if (!user) throw new Error("User not found");

    const existingEmailUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmailUser && existingEmailUser.id !== id) {
      throw new Error("Email already in use");
    }

    const existingPhoneUser = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existingPhoneUser && existingPhoneUser.id !== id) {
      throw new Error("Phone number already in use");
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
}