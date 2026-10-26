import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Owner } from '../owners/owner.entity.js';

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

  @Column({ name: 'registration_number', length: 30 })
  registrationNumber!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ name: 'passenger_capacity', type: 'integer' })
  passengerCapacity!: number;

  @Column({ name: 'coverage_zone', length: 120 })
  coverageZone!: string;

  @Column({ type: 'enum', enum: BoatStatus, default: BoatStatus.ACTIVE })
  status!: BoatStatus;

  @Column({
    name: 'verification_status',
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  verificationStatus!: VerificationStatus;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy!: string | null;

  @Column({ name: 'verification_reason', type: 'text', nullable: true })
  verificationReason!: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @ManyToOne('Owner', (owner: Owner) => owner.boats, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'owner_id' })
  owner!: Owner;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
