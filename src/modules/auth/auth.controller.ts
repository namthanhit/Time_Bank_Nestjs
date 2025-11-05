import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginAdminDto, LoginDto } from './dtos/login.dto';
import { RefreshDto } from './dtos/refresh.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const ua = req.headers['user-agent'] as string | undefined;
    const deviceInfo = dto.deviceName || ua || 'Unknown Device';

    return this.authService.login({
      phone: dto.phone,
      password: dto.password,
      ip,
      deviceInfo,
    });
  }

  @Post('admin/login')
  async loginAdmin(@Body() dto: LoginAdminDto, @Req() req: any) {
    const ip = dto.ip || req.ip;
    const deviceInfo = dto.deviceInfo || req.get('User-Agent') || undefined;
    return this.authService.loginAdmin({
      fullname: dto.fullname,
      password: dto.password,
      ip,
      deviceInfo,
    });
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto, @Req() req: any) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const ua = req.headers['user-agent'] as string | undefined;

    return this.authService.refresh({
      refresh_token: dto.refresh_token,
      ip,
      deviceInfo: ua,
    });
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Body() dto: RefreshDto) {
    return this.authService.logout({ refresh_token: dto.refresh_token });
  }

  @Post('logout-all')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logoutAll(@Req() req: any) {
    const userId = String(req.user.sub);
    return this.authService.logoutAll(userId);
  }
}
