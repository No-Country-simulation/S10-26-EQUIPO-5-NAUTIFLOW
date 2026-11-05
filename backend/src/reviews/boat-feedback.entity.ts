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
import type { Trip } from '../trips/trip.entity.js';

@Entity('boat_feedback')
@Unique('UQ_boat_feedback_trip', ['tripId'])
export class BoatFeedback {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trip_id', type: 'uuid', nullable: true })
  tripId!: string | null;

  @OneToOne('Trip', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'trip_id' })
  trip!: Trip | null;

  @Column({ name: 'boat_id', type: 'uuid' })
  boatId!: string;

  @ManyToOne('Boat', (boat: Boat) => boat.feedback, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'boat_id' })
  boat!: Boat;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @ManyToOne('Owner', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: Owner;

  @Column({ type: 'integer' })
  rating!: number;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
