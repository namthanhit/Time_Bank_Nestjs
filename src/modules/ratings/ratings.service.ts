import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateRatingDto } from './dtos/create-rating.dto';
import { AddRatingImagesDto } from './dtos/add-rating-images.dto';
import { UpdateRatingDto } from './dtos/update-rating.dto';
import { UpdateRatingImageDto } from './dtos/update-rating-image.dto';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kiểm tra:
   * - Booking tồn tại
   * - rater phải là requester hoặc provider
   * - ratee là người còn lại
   * - Không tồn tại rating trùng (booking_id, rater_id)
   */
  private async ensureCanRate(bookingId: string, raterId: string, rateeId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { requester_id: true, provider_id: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const { requester_id, provider_id } = booking;
    const isRaterInBooking = raterId === requester_id || raterId === provider_id;
    if (!isRaterInBooking) throw new ForbiddenException('Rater is not part of this booking');

    const other = raterId === requester_id ? provider_id : requester_id;
    if (rateeId !== other) {
      throw new BadRequestException('ratee_id must be the other participant in the booking');
    }

    const existed = await this.prisma.rating.findUnique({
      where: { booking_id_rater_id: { booking_id: bookingId, rater_id: raterId } },
    });
    if (existed) {
      throw new BadRequestException('You have already rated this booking');
    }

    return booking;
  }

  /**
   * Tạo rating (có thể kèm danh sách ảnh inline)
   */
  async create(raterId: string, dto: CreateRatingDto) {
    await this.ensureCanRate(dto.booking_id, raterId, dto.ratee_id);

    return this.prisma.$transaction(async (tx) => {
      const rating = await tx.rating.create({
        data: {
          booking_id: dto.booking_id,
          rater_id: raterId,
          ratee_id: dto.ratee_id,
          stars: dto.stars,
          comment: dto.comment ?? null,
        },
      });

      if (dto.images?.length) {
        // Tạo Image (nếu cần) và RatingImage
        for (const [i, it] of dto.images.entries()) {
          const image = await tx.image.create({
            data: {
              url: it.url,
              alt_text: it.alt_text ?? null,
            },
          });
          await tx.ratingImage.create({
            data: {
              rating_id: rating.id,
              image_id: image.id,
              caption: it.caption ?? null,
              position: typeof it.position === 'number' ? it.position : i,
            },
          });
        }
      }

      return this.findOne(rating.id); // trả về kèm images
    });
  }

  /**
   * Lấy chi tiết rating kèm ảnh
   */
  async findOne(id: string) {
    const rating = await this.prisma.rating.findUnique({
      where: { id },
      include: {
        rater: { select: { id: true, full_name: true, avatar_url: true } },
        ratee: { select: { id: true, full_name: true, avatar_url: true } },
        ratingImages: {
          orderBy: { position: 'asc' },
          include: { image: true },
        },
      },
    });
    if (!rating) throw new NotFoundException('Rating not found');
    return rating;
  }

  /**
   * Cập nhật sao/comment (chỉ chủ rating mới được sửa)
   */
  async update(ratingId: string, raterId: string, dto: UpdateRatingDto) {
    const rating = await this.prisma.rating.findUnique({ where: { id: ratingId } });
    if (!rating) throw new NotFoundException('Rating not found');
    if (rating.rater_id !== raterId) throw new ForbiddenException('Only owner can update this rating');

    return this.prisma.rating.update({
      where: { id: ratingId },
      data: {
        stars: dto.stars ?? rating.stars,
        comment: typeof dto.comment === 'string' ? dto.comment : rating.comment,
      },
      include: {
        ratingImages: { orderBy: { position: 'asc' }, include: { image: true } },
      },
    });
  }

  /**
   * Xoá rating (chỉ chủ rating hoặc admin — ở đây check chủ rating)
   */
  async remove(ratingId: string, raterId: string) {
    const rating = await this.prisma.rating.findUnique({ where: { id: ratingId } });
    if (!rating) throw new NotFoundException('Rating not found');
    if (rating.rater_id !== raterId) throw new ForbiddenException('Only owner can delete this rating');

    await this.prisma.rating.delete({ where: { id: ratingId } });
    return { ok: true };
  }

  /**
   * Thêm ảnh vào rating: nhận danh sách items,
   * - nếu có image_id: attach
   * - nếu có url: tạo Image rồi attach
   */
  async addImages(ratingId: string, raterId: string, payload: AddRatingImagesDto) {
    const rating = await this.prisma.rating.findUnique({ where: { id: ratingId } });
    if (!rating) throw new NotFoundException('Rating not found');
    if (rating.rater_id !== raterId) throw new ForbiddenException('Only owner can add images');

    return this.prisma.$transaction(async (tx) => {
      const created: any[] = [];

      // Lấy vị trí hiện tại lớn nhất để append cuối nếu không truyền position
      const last = await tx.ratingImage.findFirst({
        where: { rating_id: ratingId },
        orderBy: { position: 'desc' },
      });
      let base = last ? last.position + 1 : 0;

      for (const it of payload.items) {
        let imageId = it.image_id;
        if (!imageId) {
          if (!it.url) throw new BadRequestException('Either image_id or url is required');
          const img = await tx.image.create({
            data: { url: it.url, alt_text: it.alt_text ?? null },
          });
          imageId = img.id;
        }

        const rel = await tx.ratingImage.create({
          data: {
            rating_id: ratingId,
            image_id: imageId,
            caption: it.caption ?? null,
            position: typeof it.position === 'number' ? it.position : base++,
          },
          include: { image: true },
        });
        created.push(rel);
      }

      // Trả về rating kèm images mới
      return this.findOne(ratingId);
    });
  }

  /**
   * Cập nhật 1 ảnh (position/caption)
   */
  async updateImage(ratingId: string, ratingImageId: string, raterId: string, dto: UpdateRatingImageDto) {
    const rating = await this.prisma.rating.findUnique({ where: { id: ratingId } });
    if (!rating) throw new NotFoundException('Rating not found');
    if (rating.rater_id !== raterId) throw new ForbiddenException('Only owner can update images');

    const rel = await this.prisma.ratingImage.findUnique({ where: { id: ratingImageId } });
    if (!rel || rel.rating_id !== ratingId) throw new NotFoundException('Rating image not found');

    await this.prisma.ratingImage.update({
      where: { id: ratingImageId },
      data: {
        position: typeof dto.position === 'number' ? dto.position : rel.position,
        caption: typeof dto.caption === 'string' ? dto.caption : rel.caption,
      },
    });
    return this.findOne(ratingId);
  }

  /**
   * Xoá 1 ảnh ra khỏi rating (detach). Ảnh gốc trong Image giữ lại (có thể dùng chỗ khác).
   */
  async removeImage(ratingId: string, ratingImageId: string, raterId: string) {
    const rating = await this.prisma.rating.findUnique({ where: { id: ratingId } });
    if (!rating) throw new NotFoundException('Rating not found');
    if (rating.rater_id !== raterId) throw new ForbiddenException('Only owner can remove images');

    const rel = await this.prisma.ratingImage.findUnique({ where: { id: ratingImageId } });
    if (!rel || rel.rating_id !== ratingId) throw new NotFoundException('Rating image not found');

    await this.prisma.ratingImage.delete({ where: { id: ratingImageId } });
    return this.findOne(ratingId);
  }
}
