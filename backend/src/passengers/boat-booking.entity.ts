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
import type { BoatFeedback } from './boat-feedback.entity.js';

@Entity('boat_bookings')
@Unique('UQ_boat_bookings_passenger_boat', ['passengerId', 'boatId'])
export class BoatBooking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'boat_id', type: 'uuid' })
  boatId!: string;

  @ManyToOne('Boat', (boat: Boat) => boat.bookings, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'boat_id' })
  boat!: Boat;

  @Column({ name: 'passenger_id', type: 'uuid' })
  passengerId!: string;

  @ManyToOne('Owner', {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'passenger_id' })
  passenger!: Owner;

  @OneToOne('BoatFeedback', (feedback: BoatFeedback) => feedback.booking)
  feedback!: BoatFeedback | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

}