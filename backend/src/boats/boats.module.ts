import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Owner } from '../owners/owner.entity.js';
import { Boat } from './boat.entity.js';
import { BoatsController } from './boats.controller.js';
import { BoatsService } from './boats.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Boat, Owner])],
  controllers: [BoatsController],
  providers: [BoatsService],
  exports: [BoatsService, TypeOrmModule],
})
export class BoatsModule {}
