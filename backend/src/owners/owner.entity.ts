import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Boat } from '../boats/boat.entity.js';

@Entity('boat_owners')
export class Owner {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  fullName!: string;

  @Column({ unique: true, length: 320 })
  email!: string;

  @Column({ length: 30 })
  phone!: string;

  @OneToMany(() => Boat, (boat) => boat.owner)
  boats!: Boat[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
