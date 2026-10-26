import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Boat } from '../boats/boat.entity.js';
import { BoatsModule } from '../boats/boats.module.js';
import { Owner } from '../owners/owner.entity.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [AuthModule, BoatsModule, TypeOrmModule.forFeature([Owner, Boat])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
