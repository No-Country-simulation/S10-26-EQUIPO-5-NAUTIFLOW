import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { ReviewsService } from './reviews.service.js';

@Controller('api/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get(':token')
  getByToken(@Param('token') token: string) {
    return this.reviewsService.getByToken(token);
  }

  @Post(':token')
  createByToken(
    @Param('token') token: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createByToken(token, dto);
  }
}
