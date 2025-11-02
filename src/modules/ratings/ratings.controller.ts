import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dtos/create-rating.dto';
import { AddRatingImagesDto } from './dtos/add-rating-images.dto';
import { UpdateRatingDto } from './dtos/update-rating.dto';
import { UpdateRatingImageDto } from './dtos/update-rating-image.dto';
import { UserId } from '../../common/decorators/user-id.decorator';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('ratings')
@UseGuards(JwtAuthGuard)
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  create(
    @UserId() raterId: string,
    @Body() dto: CreateRatingDto,
  ) {
    return this.ratingsService.create(raterId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ratingsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @UserId() raterId: string,
    @Body() dto: UpdateRatingDto,
  ) {
    return this.ratingsService.update(id, raterId, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @UserId() raterId: string,
  ) {
    return this.ratingsService.remove(id, raterId);
  }

  // Ảnh
  @Post(':id/images')
  addImages(
    @Param('id') ratingId: string,
    @UserId() raterId: string,
    @Body() payload: AddRatingImagesDto,
  ) {
    return this.ratingsService.addImages(ratingId, raterId, payload);
  }

  @Patch(':id/images/:ratingImageId')
  updateImage(
    @Param('id') ratingId: string,
    @Param('ratingImageId') ratingImageId: string,
    @UserId() raterId: string,
    @Body() dto: UpdateRatingImageDto,
  ) {
    return this.ratingsService.updateImage(ratingId, ratingImageId, raterId, dto);
  }

  @Delete(':id/images/:ratingImageId')
  removeImage(
    @Param('id') ratingId: string,
    @Param('ratingImageId') ratingImageId: string,
    @UserId() raterId: string,
  ) {
    return this.ratingsService.removeImage(ratingId, ratingImageId, raterId);
  }
}
