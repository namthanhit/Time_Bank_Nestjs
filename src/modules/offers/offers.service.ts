import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { JobsService } from '../jobs/jobs.service';
import { OfferDto, UpdateOfferDto } from './typings/offers.dto';
import { NotificationType, OfferStatus, Prisma } from '@prisma/client'; 
import { BookingsService } from '../bookings/bookings.service';
import { JobStatus } from '../jobs/typings/job.enum';
import { NotificationsService } from '../notifications/notifications.service'; 

@Injectable()
export class OffersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly jobsService: JobsService,
    private readonly bookingService: BookingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createOffer(userId: string, dto: OfferDto) {
    const job = await this.jobsService.getJobById(userId, dto.job_id);
    const existingOffer = await this.prismaService.offer.findFirst({
      where: { service_id: job.id, user_id: userId },
    });

    if (existingOffer) throw new BadRequestException('Offer existed');

    const data: Prisma.OfferCreateInput = {
      user: { connect: { id: userId } },
      service: { connect: { id: job.id } },
      status: OfferStatus.pending,
      ...(dto.note?.trim() && { note: dto.note.trim() }),
    };

    const newOffer = await this.prismaService.offer.create({ 
      data,
      select: { id: true, user_id: true }
    }); 

    const offeringUser = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { full_name: true }
    });
    await this.notificationsService.createOnceAndPush({
      userId: job.user_id,
      title: 'Đã nhận được Offer mới',
      body: `${offeringUser?.full_name || 'Một người dùng mới'} vừa gửi Offer cho công việc "${job.title}".`,
      type: NotificationType.OFFER_RECEIVED,
      data: { 
        jobId: job.id,
        offerId: newOffer.id,
        offeringUserId: userId,
        offeringUserName: offeringUser?.full_name || 'Người dùng',
        createdAt: new Date().toISOString(), 
      },
      dedupeKey: `offer:${newOffer.id}:received`,
    });

    return { success: true };
  }

  async getStatusOffer(jobId: string, userId: string) {
    const offer = await this.prismaService.offer.findFirst({
      where: {
        service_id: jobId,
        user_id: userId,
      },
      select: {
        status: true
      }
    });
    if (!offer) return { offer: false };

    return { offer: offer.status };
  }

  async getOffersForMyJob(userId: string, jobId: string) {
    const job = await this.jobsService.getDetailMyJob(userId, jobId);

    const offers = await this.prismaService.offer.findMany({
      where: {
        service_id: jobId,
      },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            avatar_url: true,
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
          avata: offer.service.user.avatar_url,
        },
      },
    }));
  }

  private async validateOffer(userId: string, offerId: string, jobId: string) {
    const offerForMyJob = await this.prismaService.offer.findFirst({
      where: {
        id: offerId,
        service_id: jobId,
        service: {
          user_id: userId,
        },
      },
      select: {
        id: true,
        service_id: true,
        user_id: true, 
        note: true,
      }
    });
    if (!offerForMyJob)
      throw new NotFoundException(
        'Offer not found or you do not have permission to update this job',
      );

    const service = await this.prismaService.service.findUnique({
      where: {
        id: offerForMyJob.service_id,
      },
      select: { id: true, title: true }
    });
    if (!service) throw new NotFoundException('Not found service');

    return { offerForMyJob, service };
  }

  async acceptOfferForMyJob(
    userId: string,
    offerId: string,
    jobId: string,
    dto: UpdateOfferDto,
  ) {
    const { offerForMyJob, service } = await this.validateOffer(
      userId,
      offerId,
      jobId,
    );
    
    const jobOwner = await this.prismaService.user.findUnique({
        where: { id: userId },
        select: { full_name: true }
    });

    if (dto.status === OfferStatus.accepted) {
      await this.prismaService.$transaction(async (tx) => {
        await tx.offer.update({
          where: { id: offerForMyJob.id, },
          data: { status: OfferStatus.accepted, },
        });
        await this.bookingService.createBooking(
          service.id,
          offerForMyJob.id,
          tx,
        );

        await this.notificationsService.createOnceAndPush({
          userId: offerForMyJob.user_id,
          title: 'Offer của bạn đã được chấp nhận!',
          body: `Chủ job ${jobOwner?.full_name || 'của bạn'} đã chấp nhận Offer cho công việc "${service.title}".`,
          type: NotificationType.OFFER_ACCEPTED,
          data: { 
            jobId: service.id, 
            offerId: offerForMyJob.id, 
            jobTitle: service.title,
            createdAt: new Date().toISOString(),
          },
          dedupeKey: `offer:${offerForMyJob.id}:accepted`,
        });
      });
    } else if (dto.status === OfferStatus.cancelled) {
      await this.prismaService.$transaction(async (tx) => {
        await tx.offer.update({
          where: {
            id: offerForMyJob.id,
          },
          data: {
            status: OfferStatus.cancelled,
          },
        });
        await this.bookingService.cancelBooking(
          service.id,
          offerForMyJob.id,
          tx,
        );
      });
    }

    return {
      success: true,
    };
  }

  async rejectOfferForMyJob(
    userId: string,
    offerId: string,
    jobId: string,
    dto: UpdateOfferDto,
  ) {
    const { offerForMyJob, service } = await this.validateOffer(userId, offerId, jobId);

    if (dto.status === OfferStatus.rejected) {
      await this.prismaService.offer.update({
        where: {
          id: offerForMyJob.id,
        },
        data: {
          status: OfferStatus.rejected,
        },
      });

    
      await this.notificationsService.createOnceAndPush({
          userId: offerForMyJob.user_id,
          title: 'Offer của bạn đã bị từ chối',
          body: `Offer của bạn cho công việc "${service.title}" đã bị từ chối.`,
          type: NotificationType.OFFER_REJECTED,
          data: { 
            jobId: service.id, 
            offerId: offerForMyJob.id, 
            jobTitle: service.title,
            createdAt: new Date().toISOString(), 
          },
          dedupeKey: `offer:${offerForMyJob.id}:rejected`,
        });
    } else if (dto.status === OfferStatus.accepted) {
      await this.prismaService.offer.update({
        where: {
          id: offerForMyJob.id,
        },
        data: {
          status: OfferStatus.accepted,
        },
      });
    }

    return {
      success: true,
    };
  }

  async cancelMyOffer(userId: string, job_id: string) {
    const offer = await this.prismaService.offer.findFirst({
      where: {
        service_id: job_id,
        user_id: userId,
      },
    });
    if (!offer) throw new NotFoundException('Not found offer of you');

    if (offer.status === OfferStatus.pending) {
      await this.prismaService.offer.delete({
        where: {
          id: offer.id,
        }
      });

      return {
        success: true,
      };
    }

    await this.prismaService.offer.update({
      where: {
        id: offer.id,
      },
      data: {
        status: OfferStatus.withdrawn,
      },
    });

    return {
      success: true,
    };
  }

  async getMyJobsWithPendingOrWithdrawOffers(userId: string) {
    const jobsWithOffers = await this.prismaService.service.findMany({
      where: {
        user_id: userId,
        offers: {
          some: {
            status: {
              in: [OfferStatus.pending, OfferStatus.withdrawn],
            },
          },
        },
      },
      include: {
        offers: {
          where: {
            status: {
              in: [OfferStatus.pending, OfferStatus.withdrawn],
            },
          },
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
                avatar_url: true,
              },
            },
          },
        },
      },
    });
    return jobsWithOffers;
  }
}