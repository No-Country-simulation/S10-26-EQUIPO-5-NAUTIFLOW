import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Owner } from '../owners/owner.entity.js';

export enum BoatStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum VerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('boats')
@Unique('UQ_boats_registration_number', ['registrationNumber'])
export class Boat {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 30 })
  registrationNumber!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ type: 'integer' })
  passengerCapacity!: number;

  @Column({ length: 120 })
  coverageZone!: string;

  @Column({ type: 'enum', enum: BoatStatus, default: BoatStatus.ACTIVE })
  status!: BoatStatus;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  verificationStatus!: VerificationStatus;

  @ManyToOne(() => Owner, (owner) => owner.boats, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'owner_id' })
  owner!: Owner;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
