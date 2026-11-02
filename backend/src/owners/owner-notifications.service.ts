import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OwnerNotification } from './owner-notification.entity.js';

@Injectable()
export class OwnerNotificationsService {
  constructor(
    @InjectRepository(OwnerNotification)
    private readonly notificationsRepository: Repository<OwnerNotification>,
  ) {}

  listForOwner(ownerId: string) {
    return this.notificationsRepository.find({
      where: { ownerId },
      select: {
        id: true,
        message: true,
        readAt: true,
        createdAt: true,
      },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }
}
