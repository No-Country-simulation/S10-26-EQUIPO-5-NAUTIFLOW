import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export interface UploadedImage {
  secureUrl: string;
  publicId: string;
  resourceType: 'image' | 'raw';
  width: number;
  height: number;
  format: string;
  bytes: number;
}

@Injectable()
export class CloudinaryService {
  private readonly folder: string;

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.getOrThrow<string>(
      'CLOUDINARY_CLOUD_NAME',
    );
    const apiKey = this.configService.getOrThrow<string>(
      'CLOUDINARY_API_KEY',
    );
    const apiSecret = this.configService.getOrThrow<string>(
      'CLOUDINARY_API_SECRET',
    );

    this.folder =
      this.configService.get<string>('CLOUDINARY_FOLDER') ?? 'nautiflow/boats';

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  async uploadBoatImage(
    file: Express.Multer.File,
    boatId: string,
  ): Promise<UploadedImage> {
    if (!file?.buffer) {
      throw new BadRequestException('Debe enviarse una imagen o un PDF');
    }

    const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'image';

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: this.folder,
          public_id: `boat-${boatId}`,
          resource_type: resourceType,
          overwrite: true,
          invalidate: true,
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error', {
              message: error.message,
              name: error.name,
              http_code: error.http_code,
            });
            reject(
              new InternalServerErrorException(
                'No se pudo subir la imagen a Cloudinary',
              ),
            );
            return;
          }

          if (!result) {
            reject(
              new InternalServerErrorException(
                'Cloudinary no devolvió información de la imagen',
              ),
            );
            return;
          }

          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
            resourceType,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
          });
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  async deleteImage(
    publicId: string,
    resourceType: 'image' | 'raw' = 'image',
  ): Promise<void> {
    if (!publicId) {
      return;
    }

    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
  }
}