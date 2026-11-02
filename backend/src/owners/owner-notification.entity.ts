import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Owner } from './owner.entity.js';
import type { BoatFeedback } from '../passengers/boat-feedback.entity.js';

@Entity('owner_notifications')
export class OwnerNotification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @ManyToOne('Owner', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: Owner;

  @Column({ name: 'feedback_id', type: 'uuid', unique: true })
  feedbackId!: string;

  @ManyToOne('BoatFeedback', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'feedback_id' })
  feedback!: BoatFeedback;

  @Column({ type: 'text' })
  message!: string;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
