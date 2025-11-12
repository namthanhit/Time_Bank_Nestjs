import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/prisma/prisma.service';

@Injectable()
export class FollowsService {
  constructor(private prisma: PrismaService) {}

  async follow(followerId: string, followeeId: string) {
    if (followerId === followeeId) {
      throw new BadRequestException('You cannot follow yourself.');
    }

    const followee = await this.prisma.user.findUnique({
      where: { id: followeeId },
    });

    if (!followee) {
      throw new NotFoundException('User to follow not found.');
    }

    try {
      const newFollow = await this.prisma.follow.create({
        data: {
          follower_id: followerId,
          followee_id: followeeId,
        },
      });
      return newFollow;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('You are already following this user.');
      }
      throw error;
    }
  }

  async unfollow(followerId: string, followeeId: string) {
    try {
      await this.prisma.follow.delete({
        where: {
          follower_id_followee_id: {
            follower_id: followerId,
            followee_id: followeeId,
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Follow relationship not found.');
      }
      throw error;
    }
  }

  async getFollowingCount(userId: string) {
    const count = await this.prisma.follow.count({
      where: { follower_id: userId },
    });
    return { count };
  }

  async getFollowersCount(userId: string) {
    const count = await this.prisma.follow.count({
      where: { followee_id: userId },
    });
    return { count };
  }
}