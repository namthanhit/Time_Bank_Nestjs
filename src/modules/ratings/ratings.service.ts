import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service'; 
import { CreateRatingDto } from './dtos/create-rating.dto';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class RatingService {
  constructor(private prisma: PrismaService) {}

async getPendingRatings(userId: string) {
  console.log('Current User ID:', userId); 

  const bookings = await this.prisma.booking.findMany({
    where: {
    
      status: 'completed', 
   
      OR: [
        { requester_id: userId },
        { provider_id: userId },
      ],
    
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
      requester: { select: { id: true, full_name: true, avatar_url: true } },
      provider: { select: { id: true, full_name: true, avatar_url: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  return bookings.map((booking) => this.mapBookingToResponse(booking, userId));
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
            requester: { select: { id: true, full_name: true, avatar_url: true } },
            provider: { select: { id: true, full_name: true, avatar_url: true } },
          },
        },
        ratingImages: {
          include: {
            image: true, 
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return ratings.map((rating) => {
      const bookingData = this.mapBookingToResponse(rating.booking, userId);

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
    if (booking.status !== BookingStatus.completed) {
      throw new BadRequestException('Chỉ có thể đánh giá các công việc đã hoàn thành');
    }

    let rateeId = '';
    if (booking.requester_id === userId) {
      rateeId = booking.provider_id; 
    } else if (booking.provider_id === userId) {
      rateeId = booking.requester_id;
    } else {
      throw new BadRequestException('Bạn không tham gia vào booking này');
    }

    const existingRating = await this.prisma.rating.findFirst({
      where: {
        booking_id: dto.booking_id,
        rater_id: userId,
      },
    });

    if (existingRating) {
      throw new BadRequestException('Bạn đã đánh giá công việc này rồi');
    }

    const imageConnections = dto.image_ids?.map((imgId) => ({
       image: { connect: { id: imgId } }
    })) || [];

    return this.prisma.rating.create({
      data: {
        booking_id: dto.booking_id,
        rater_id: userId,
        ratee_id: rateeId,
        stars: dto.stars,
        comment: dto.comment,
        ratingImages: {
          create: imageConnections,
        },
      },
      include: {
        ratingImages: {
          include: { image: true },
        },
      },
    });
  }

  private mapBookingToResponse(booking: any, currentUserId: string) {
    const isRequester = booking.requester_id === currentUserId;
    const partner = isRequester ? booking.provider : booking.requester;
    const skills = booking.service.serviceSkills?.map((ss: any) => ss.skill.name) || [];

    return {
      booking_id: booking.id,
      service_id: booking.service.id,
      service_title: booking.service.title,

      partner_id: partner.id,
      partner_name: partner.full_name,
      partner_avatar: partner.avatar_url,
 
      start_at: booking.start_at,     
      duration_secs: booking.secs_booked, 
      place: booking.place || booking.service.place,
      
      skills: skills, 
      status: booking.status,
    };
  }
}