import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Boat } from '../boats/boat.entity.js';
import type { Owner } from '../owners/owner.entity.js';

@Entity('empty_legs')
export class EmptyLeg {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'boat_id', type: 'uuid' })
  boatId!: string;

  @ManyToOne('Boat', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'boat_id' })
  boat!: Boat;

  @Column({ length: 120 })
  origin!: string;

  @Column({ length: 120 })
  destination!: string;

  @Column({ name: 'returns_at', type: 'timestamptz' })
  returnsAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @ManyToOne('Owner', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator!: Owner | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
