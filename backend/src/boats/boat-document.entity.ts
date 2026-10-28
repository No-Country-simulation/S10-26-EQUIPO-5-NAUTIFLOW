import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export enum BoatDocumentType {
  LICENSE = 'license',
  INSURANCE = 'insurance',
  CRIMINAL_RECORD = 'criminalRecord',
}

export enum BoatDocumentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('boat_documents')
@Unique('UQ_boat_documents_boat_type', ['boatId', 'type'])
export class BoatDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'boat_id', type: 'uuid' })
  boatId!: string;

  @Column({ type: 'varchar', length: 30 })
  type!: BoatDocumentType;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl!: string;

  @Column({ name: 'file_public_id', type: 'text' })
  filePublicId!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ name: 'file_size', type: 'integer' })
  fileSize!: number;

  @Column({
    name: 'verification_status',
    type: 'varchar',
    length: 20,
    default: BoatDocumentStatus.PENDING,
  })
  verificationStatus!: BoatDocumentStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
