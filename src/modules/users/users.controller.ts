import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './typings/user.update.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserId } from '../../common/decorators/user-id.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard) // bảo vệ toàn bộ controller
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Chỉ lấy hồ sơ của chính mình
  @Get('me')
  async getMe(@UserId() userId: string) {
    return this.usersService.getUserDetailById(userId);
  }

  // Cập nhật hồ sơ của chính mình
  @Patch('me')
  async updateMe(@UserId() userId: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUserById(userId, dto);
  }
}