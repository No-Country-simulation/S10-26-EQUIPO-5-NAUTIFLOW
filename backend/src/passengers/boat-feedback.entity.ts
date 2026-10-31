import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Owner } from '../owners/owner.entity.js';
import type { Boat } from '../boats/boat.entity.js';
import type { BoatBooking } from './boat-booking.entity.js';

@Entity('boat_feedback')
@Unique('UQ_boat_feedback_booking', ['bookingId'])
export class BoatFeedback {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId!: string;

  @OneToOne('BoatBooking', (booking: BoatBooking) => booking.feedback, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'booking_id' })
  booking!: BoatBooking;

  @Column({ name: 'boat_id', type: 'uuid' })
  boatId!: string;

  @ManyToOne('Boat', (boat: Boat) => boat.feedback, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'boat_id' })
  boat!: Boat;

  @Column({ name: 'passenger_id', type: 'uuid' })
  passengerId!: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @ManyToOne('Owner', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: Owner;

  @ManyToOne('Owner', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'passenger_id' })
  passenger!: Owner;

  @Column({ type: 'integer' })
  rating!: number;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}