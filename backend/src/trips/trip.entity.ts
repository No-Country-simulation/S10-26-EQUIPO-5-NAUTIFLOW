import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Boat } from '../boats/boat.entity.js';
import type { EmptyLeg } from '../admin/empty-leg.entity.js';

@Entity('trips')
@Unique('UQ_trips_empty_leg_id', ['emptyLegId'])
@Check('CHK_trips_time_order', '"ends_at" IS NULL OR "ends_at" > "starts_at"')
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'boat_id', type: 'uuid' })
  boatId!: string;

  @ManyToOne('Boat', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'boat_id' })
  boat!: Boat;

  @Column({ name: 'empty_leg_id', type: 'uuid', nullable: true })
  emptyLegId!: string | null;

  @ManyToOne('EmptyLeg', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'empty_leg_id' })
  emptyLeg!: EmptyLeg | null;

  @Column({ length: 120 })
  origin!: string;

  @Column({ length: 120 })
  destination!: string;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'review_token_hash', type: 'varchar', length: 64, nullable: true })
  reviewTokenHash!: string | null;

  @Column({ name: 'review_token_expires_at', type: 'timestamptz', nullable: true })
  reviewTokenExpiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
