import {
  Body,
  Controller,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CreateBoatDto } from './dto/create-boat.dto.js';
import { BoatsService } from './boats.service.js';

@Controller('api/boats')
export class BoatsController {
  constructor(private readonly boatsService: BoatsService) {}

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
}
