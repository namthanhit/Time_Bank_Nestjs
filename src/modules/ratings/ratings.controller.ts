import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  UseGuards 
} from '@nestjs/common';
import { RatingService } from './ratings.service';
import { CreateRatingDto } from './dtos/create-rating.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'; 
import { UserId } from 'src/common/decorators/user-id.decorator'; 

@Controller('ratings')
@UseGuards(JwtAuthGuard)
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}
  @Get('pending')
  async getPending(@UserId() userId: string) {
    return this.ratingService.getPendingRatings(userId);
  }

  @Get('history')
  async getHistory(@UserId() userId: string) {
    return this.ratingService.getRatingHistory(userId);
  }

  @Post()
  async create(
    @UserId() userId: string, 
    @Body() createRatingDto: CreateRatingDto
  ) {
    return this.ratingService.createRating(userId, createRatingDto);
  }
}