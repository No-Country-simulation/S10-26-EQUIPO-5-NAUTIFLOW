import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
  UploadedFiles,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CreateBoatDto } from './dto/create-boat.dto.js';
import { BoatsService } from './boats.service.js';
import { BoatDocumentType } from './boat-document.entity.js';
import { OwnerAuthGuard } from '../auth/owner-auth.guard.js';

interface AuthenticatedRequest extends Request {
  user: { sub: string };
}

@Controller('api/boats')
export class BoatsController {
  constructor(private readonly boatsService: BoatsService) {}

  @Get()
  listAvailable() {
    return this.boatsService.listAvailable();
  }

  @Get('mine')
  @UseGuards(OwnerAuthGuard)
  listMine(@Req() request: AuthenticatedRequest) {
    return this.boatsService.listByOwner(request.user.sub);
  }

  @Post()
  create(@Body() dto: CreateBoatDto) {
    return this.boatsService.create(dto);
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadImage(
    @Param('id', new ParseUUIDPipe()) boatId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /^(image\/(jpeg|png|webp)|application\/pdf)$/,
        })
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024,
        })
        .build({
          fileIsRequired: true,
        }),
    )
    file: Express.Multer.File,
  ) {
    return this.boatsService.uploadImage(boatId, file);
  }

  @Post(':id/documents')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: BoatDocumentType.LICENSE, maxCount: 1 },
        { name: BoatDocumentType.INSURANCE, maxCount: 1 },
        { name: BoatDocumentType.CRIMINAL_RECORD, maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 },
      },
    ),
  )
  uploadDocuments(
    @Param('id', new ParseUUIDPipe()) boatId: string,
    @UploadedFiles()
    files: Partial<Record<BoatDocumentType, Express.Multer.File[]>>,
  ) {
    if (!files) {
      throw new BadRequestException('Debe enviarse la documentación requerida');
    }
    for (const file of Object.values(files).flat()) {
      if (
        !/^(application\/pdf|image\/(jpeg|png))$/.test(file.mimetype) ||
        file.size > 5 * 1024 * 1024
      ) {
        throw new BadRequestException(
          'Cada documento debe ser PDF, JPG, JPEG o PNG y pesar hasta 5 MB',
        );
      }
    }
    return this.boatsService.uploadDocuments(boatId, files);
  }
}
