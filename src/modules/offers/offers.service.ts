import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { JobsService } from '../jobs/jobs.service';
import { OfferDto, UpdateOfferDto } from './typings/offers.dto';
import { BookingStatus, OfferStatus, Prisma } from '@prisma/client';
import { BookingsService } from '../bookings/bookings.service';

@Injectable()
export class OffersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly jobsService: JobsService,
    private readonly bookingService: BookingsService
  ) {}

  async createOffer(userId: string, dto: OfferDto) {
    const job = await this.jobsService.getJobById(userId, dto.job_id);

    const data: Prisma.OfferCreateInput = {
      user: { connect: { id: userId } },
      service: { connect: { id: job.id } },
      status: OfferStatus.pending,
      ...(dto.note?.trim() && { note: dto.note.trim() }),
    };

    await this.prismaService.offer.create({ data });

    return { success: true };
  }

  async getOffersForMyJob(userId: string, jobId: string) {
    const job = await this.jobsService.getDetailMyJob(userId, jobId);

    const offers = await this.prismaService.offer.findMany({
      where: { 
        service_id: jobId 
      },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            avatar_url: true
          },
        },
      },
    });

    if (offers.length === 0) {
      throw new NotFoundException('No offers found for this job');
    }

    return {
      ...job,
      offers: offers.map((offer) => ({
        id: offer.id,
        note: offer.note,
        status: offer.status,
        created_at: offer.created_at,
        user: offer.user,
      })),
    };
  }

  async getMyOffers(userId: string) {
    const offers = await this.prismaService.offer.findMany({
      where: { user_id: userId },
      include: {
        service: {
          include: {
            user: true,
          },
        },
      },
    });

    if (offers.length === 0) {
      throw new NotFoundException('You did not apply for any job');
    }

    return offers.map((offer) => ({
      offer_id: offer.id,
      created_at: offer.created_at,
      service: {
        id: offer.service.id,
        title: offer.service.title,
        description: offer.service.description,
        user: {
          id: offer.service.user.id,
          full_name: offer.service.user.full_name,
          avata: offer.service.user.avatar_url
        },
      },
    }));
  }

  private async validateOffer(userId: string, offerId: string, jobId: string){
    const offerForMyJob = await this.prismaService.offer.findFirst({
      where: {
        id: offerId,
        service_id: jobId,
        service: {
          user_id: userId,
        },
      },
    });
    if(!offerForMyJob) throw new NotFoundException("Offer not found or you do not have permission to update this job")

    const service = await this.prismaService.service.findUnique({
      where:{
        id: offerForMyJob.service_id
      }
    })
    if(!service) throw new NotFoundException("Not found service")

    return { offerForMyJob, service }
  }

  async acceptOfferForMyJob(userId: string, offerId: string, jobId: string, dto: UpdateOfferDto){
    const { offerForMyJob, service } = await this.validateOffer(userId, offerId, jobId)

    // chấp nhận yêu cầu offer vào job
    if(dto.status === OfferStatus.accepted){
      await this.prismaService.$transaction(async (tx) => {
        await tx.offer.update({
          where:{
            id: offerForMyJob.id,
          },
          data:{
            status: OfferStatus.accepted
          }
        })
        await this.bookingService.createBooking(service.id, offerForMyJob.id, tx)
      });
    } else if (dto.status === OfferStatus.cancelled){
      await this.prismaService.$transaction(async (tx) => {
        await tx.offer.update({
          where:{
            id: offerForMyJob.id,
          },
          data:{
            status: OfferStatus.cancelled
          }
        })
        await this.bookingService.cancelBooking(service.id, offerForMyJob.id, tx)
      });
    }

    return {
      success: true
    };
  }

  async rejectOfferForMyJob(userId: string, offerId: string, jobId: string, dto: UpdateOfferDto){
    const { offerForMyJob } = await this.validateOffer(userId, offerId, jobId)

    if(dto.status === OfferStatus.rejected){
      await this.prismaService.offer.update({
        where:{
          id: offerForMyJob.id,
        },
        data:{
          status: OfferStatus.rejected
        }
      })
    } else if (dto.status === OfferStatus.accepted){
      await this.prismaService.offer.update({
        where:{
          id: offerForMyJob.id,
        },
        data:{
          status: OfferStatus.accepted
        }
      })
    }

    return {
      success: true
    };
  }

  async cancelMyOffer(userId: string, offerId: string){
    const offer = await this.prismaService.offer.findUnique({
      where: {
        id: offerId,
        user_id: userId
      }
    })
    if (!offer) throw new NotFoundException("Not found offer of you")

    if (offer.status === OfferStatus.pending){
      await this.prismaService.offer.update({
        where:{
          id: offer.id,
        },
        data:{
          status: OfferStatus.cancelled
        }
      })

      return {
        success: true
      };
    }

    await this.prismaService.offer.update({
      where:{
        id: offer.id,
      },
      data:{
        status: OfferStatus.withdrawn
      }
    })

    return {
      success: true
    };
  }

}
