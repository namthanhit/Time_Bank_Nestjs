import { Controller, Get, Patch, Body, UseGuards, Delete, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './typings/user.update.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserId } from '../../common/decorators/user-id.decorator';
import { AdminGuard } from 'src/common/guards/admin-guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
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
    return this.usersService.getUserDetailById(userId);
  }

  // Cập nhật hồ sơ của chính mình
  @UseGuards(JwtAuthGuard)
  @Patch('me')
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
}