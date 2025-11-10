import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaClient } from '@prisma/client/extension';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import dayjs from 'dayjs';
import { QueueService } from 'src/infra/queue/queue.service';
import { FIFTEEN_MINUTES_MS, TWENTY_FOUR_HOURS_MS } from 'src/common/constants';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  private async validateDtoBooking(service_id: string, offer_id: string) {
    const service = await this.prismaService.service.findUnique({
      where: {
        id: service_id,
      },
    });
    if (!service) throw new NotFoundException('Not found or service not exist');

    const offer = await this.prismaService.offer.findUnique({
      where: {
        id: offer_id,
      },
    });

    if (!offer) throw new NotFoundException('Not found or offer not exist');

    return { service, offer };
  }

  async createBooking(service_id: string, offer_id: string, tx: PrismaClient) {
    const { service, offer } = await this.validateDtoBooking(
      service_id,
      offer_id,
    );

    if (service.preferred_start == null) {
      throw new BadRequestException('Service preferred_start is required');
    }

    const booking = await tx.booking.create({
      data: {
        service_id: service.id,
        offer_id: offer.id,
        requester_id: service.user_id,
        provider_id: offer.user_id,
        start_at: service.preferred_start,
        secs_booked: service.time,
        place: service.place,
        status: BookingStatus.scheduled,
      },
    });

    await this.queueService.scheduleJob(
      'check-no-show',
      { bookingId: booking.id, providerId: booking.provider_id },
      booking.start_at.getTime() - Date.now() + FIFTEEN_MINUTES_MS,
      `check-no-show-${booking.id}`,
    );

    return {
      success: true,
    };
  }

  async completeBooking(service_id: string, tx: PrismaClient) {
    const service = await this.prismaService.service.findUnique({
      where: { id: service_id },
    });
    if (!service) throw new NotFoundException('Service not found');

    const escrow = await this.prismaService.escrowWallet.findUnique({
      where: { job_id: service.id },
    });
    if (!escrow) throw new NotFoundException('Escrow not found for this job');

    const bookings = await tx.booking.findMany({
      where: {
        service_id: service.id,
        status: BookingStatus.ongoing,
      },
    });

    if (bookings.length === 0) {
      throw new NotFoundException('No ongoing booking found');
    }

    for (const booking of bookings) {
      this.queueService.scheduleJob(
        'Release-escrow-funds',
        {
          escrowId: escrow.id,
          providerId: booking.provider_id,
          amount: booking.secs_booked,
        },
        TWENTY_FOUR_HOURS_MS,
        `release-escrow-funds-${escrow.id}-${booking.provider_id}-${booking.id}`,
      );
    }

    await tx.booking.updateMany({
      where: {
        service_id: service.id,
        status: BookingStatus.ongoing,
      },
      data: {
        status: BookingStatus.completed,
        completed_at: new Date(),
      },
    });

    return { success: true };
  }

  async cancelBooking(service_id: string, offer_id: string, tx: PrismaClient) {
    const { service, offer } = await this.validateDtoBooking(
      service_id,
      offer_id,
    );

    const result = await tx.booking.updateMany({
      where: {
        service_id: service.id,
        offer_id: offer.id,
      },
      data: {
        status: BookingStatus.cancelled,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Booking not found');
    }

    return {
      success: true,
    };
  }

  async getBookingByOfferId(userId: string, offer_id: string) {
    const offer = await this.prismaService.offer.findFirst({
      where: {
        id: offer_id,
        user_id: userId,
      },
    });
    if (!offer) throw new NotFoundException('Not found offer');

    const booking = await this.prismaService.booking.findFirst({
      where: {
        offer_id: offer.id,
      },
    });

    if (!booking)
      throw new NotFoundException('Your offer has not been approved yet');

    return booking;
  }

  async checkInBooking(providerId: string, bookingId: string) {
    const booking = await this.prismaService.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.provider_id !== providerId)
      throw new ForbiddenException('You are not the provider of this booking');

    if (booking.status !== BookingStatus.scheduled)
      throw new BadRequestException('Booking is no longer scheduled');

    const now = dayjs();
    const start = dayjs(booking.start_at);

    if (now.isBefore(start.subtract(10, 'minute')))
      throw new BadRequestException('Too early to check-in');
    if (now.isAfter(start.add(15, 'minute')))
      throw new BadRequestException('You are late for check-in');

    await this.prismaService.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.ongoing,
        check_in_time: now.toDate(),
      },
    });

    await this.queueService.removeJob(`check-no-show-${booking.id}`);

    return {
      success: true,
    };
  }

  async getCountBookedByjobId(userId: string, jobId: string) {
    const job = await this.prismaService.service.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException("Not found job")

    const count = await this.prismaService.booking.count({
      where: {
        service_id: jobId
      }
    })

    return count;
  }
}
