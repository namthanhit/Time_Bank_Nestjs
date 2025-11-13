import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Delete,
  Param,
  Post,
  Req,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './typings/user.update.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserId } from '../../common/decorators/user-id.decorator';
import { AdminGuard } from 'src/common/guards/admin-guard';
import { FollowsService } from '../follows/follows.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly followsService: FollowsService,
  ) {}
  // Lấy danh sách tất cả người dùng (chỉ dành cho admin)
  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  findAll() {
    return this.usersService.findAll();
  }

  // Chỉ lấy hồ sơ của chính mình
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@UserId() userId: string) {
    return this.usersService.getMeDetailById(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getUserById(@Param(":id") userId: string, @UserId() me: string) {
    return this.usersService.getUserDetailById(userId, me);
  }

  // Cập nhật hồ sơ của chính mình
  @UseGuards(JwtAuthGuard)
  @Patch('me/edit-profile')
  async updateMe(@UserId() userId: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUserById(userId, dto);
  }

  @Delete(':userId/block-user')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async blockUser(@Param('userId') userId: string) {
    return this.usersService.blockUserById(userId);
  }

  @Patch(':userId/unblock-user')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async unblockUser(@Param('userId') userId: string) {
    return this.usersService.unblockUserById(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  async followUser(@Param('id') followeeId: string, @UserId() userId: string) {
    return this.followsService.follow(userId, followeeId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/unfollow')
  unfollowUser(@Param('id') followeeId: string, @UserId() userId: string) {
    return this.followsService.unfollow(userId, followeeId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/followers/count')
  getFollowersCount(@Param('id') userId: string) {
    return this.followsService.getFollowersCount(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/following/count')
  getFollowingCount(@Param('id') userId: string) {
    return this.followsService.getFollowingCount(userId);
  }
}