import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Owner } from '../owners/owner.entity.js';
import { Boat } from './boat.entity.js';
import { BoatDocument } from './boat-document.entity.js';
import { BoatsController } from './boats.controller.js';
import { BoatsService } from './boats.service.js';
import { CloudinaryModule } from '../cloudinary/cloudinary.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Boat, BoatDocument, Owner]),
    CloudinaryModule,
    AuthModule,
  ],
  controllers: [BoatsController],
  providers: [BoatsService],
  exports: [BoatsService, TypeOrmModule],
})
export class BoatsModule {}
