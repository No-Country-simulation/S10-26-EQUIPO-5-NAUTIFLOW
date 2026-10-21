import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Boat } from '../boats/boat.entity.js';

@Entity('users')
export class Owner {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'name', length: 120 })
  fullName!: string;

  @Column({ unique: true, length: 320 })
  email!: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 200,
    nullable: true,
    select: false,
  })
  passwordHash!: string | null;

  @Column({ length: 30, default: 'owner' })
  role!: string;

  @Column({ length: 30 })
  phone!: string;

  @OneToMany('Boat', (boat: Boat) => boat.owner)
  boats!: Boat[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
