import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service'; 
import { CreateRatingDto } from './dtos/create-rating.dto';

@Injectable()
export class RatingService {
  constructor(private prisma: PrismaService) {}

  async getPendingRatings(userId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: 'completed',
        requester_id: userId, 
        ratings: {
          none: {
            rater_id: userId,
          },
        },
      },
      include: {
        service: {
          include: {
            serviceSkills: {
              include: { skill: true },
            },
          },
        },
        provider: { select: { id: true, full_name: true, avatar_url: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return bookings.map((booking) => this.mapBookingToResponse(booking));
  }

  async getRatingHistory(userId: string) {
    const ratings = await this.prisma.rating.findMany({
      where: {
        rater_id: userId, 
      },
      include: {
        booking: {
          include: {
            service: {
              include: {
                serviceSkills: { include: { skill: true } },
              },
            },
            provider: { select: { id: true, full_name: true, avatar_url: true } },
          },
        },
        ratingImages: {
          include: { image: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return ratings.map((rating) => {
      const bookingData = this.mapBookingToResponse(rating.booking);

      return {
        ...bookingData,
        rating_id: rating.id,
        stars: rating.stars,
        comment: rating.comment,
        rated_at: rating.created_at,
        images: rating.ratingImages.map((ri) => ri.image.url),
      };
    });
  }

  async createRating(userId: string, dto: CreateRatingDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.booking_id },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'completed') {
      throw new BadRequestException('Chỉ có thể đánh giá các công việc đã hoàn thành');
    }
    if (booking.requester_id !== userId) {
      throw new BadRequestException('Bạn không có quyền đánh giá (Chỉ chủ công việc mới được đánh giá)');
    }
    const rateeId = booking.provider_id;
    const existingRating = await this.prisma.rating.findFirst({
      where: {
        booking_id: dto.booking_id,
        rater_id: userId,
      },
    });

    if (existingRating) {
      throw new BadRequestException('Bạn đã đánh giá công việc này rồi');
    }
    const imageCreates = dto.image_urls?.map((url) => ({
       image: { 
         create: { 
           url: url, 
           alt_text: 'Rating Image' 
         } 
       }
    })) || [];

    return this.prisma.rating.create({
      data: {
        booking_id: dto.booking_id,
        rater_id: userId,      
        ratee_id: rateeId,     
        stars: dto.stars,
        comment: dto.comment,
        ratingImages: {
          create: imageCreates,
        },
      },
      include: {
        ratingImages: {
          include: { image: true },
        },
      },
    });
  }

  private mapBookingToResponse(booking: any) {
    const partner = booking.provider;
    const skills = booking.service.serviceSkills
      ?.map((ss: any) => ss.skill?.name)
      .filter((name: string) => !!name) || [];

    return {
      booking_id: booking.id,
      service_id: booking.service.id,
      service_title: booking.service.title,
      partner_id: partner?.id,
      partner_name: partner?.full_name,
      partner_avatar: partner?.avatar_url,
      start_at: booking.start_at,
      duration_secs: booking.secs_booked,
      place: booking.place || booking.service.place,
      skills: skills,
      status: booking.status,
    };
  }

  async getReceivedRatings(targetUserId: string) {
    const ratings = await this.prisma.rating.findMany({
      where: {
        ratee_id: targetUserId, 
      },
      include: {
        booking: {
          include: {
            service: {
              include: {
                serviceSkills: { include: { skill: true } },
              },
            },
          },
        },
        rater: { select: { id: true, full_name: true, avatar_url: true } },
        ratingImages: { include: { image: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return ratings.map((rating) => {
      return {
        rating_id: rating.id,
        booking_id: rating.booking_id,
        service_id: rating.booking.service.id,
        service_title: rating.booking.service.title,
        
        partner_id: rating.rater.id,
        partner_name: rating.rater.full_name,
        partner_avatar: rating.rater.avatar_url,
        
        stars: rating.stars,
        comment: rating.comment,
        rated_at: rating.created_at,
        images: rating.ratingImages.map((ri) => ri.image.url),

        start_at: rating.booking.start_at,
        duration_secs: rating.booking.secs_booked,
        place: rating.booking.place,
        status: 'completed',
        skills: [], 
      };
    });
  }

  async getAverageStar(userId: string) {
  const ratingAgg = await this.prisma.rating.aggregate({
    _avg: {
      stars: true,
    },
    _count: {
      stars: true, 
    },
    where: {
      ratee_id: userId,
    },
  });

  const averageRating = ratingAgg._avg.stars || 0; 
  const totalReviews = ratingAgg._count.stars || 0;

  return {
    rating: averageRating,
    total_reviews: totalReviews,
  };
}
}