import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Put,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { StorageService } from './services/storage.service.js';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Put('upload')
  @HttpCode(HttpStatus.OK)
  async uploadLocal(
    @Query('key') key: string,
    @Req() req: Request,
  ): Promise<{ success: boolean; key: string }> {
    if (!key) {
      throw new BadRequestException('Query parameter "key" is required');
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const buffer = Buffer.concat(chunks);
    const contentType = req.headers['content-type'] || 'image/jpeg';

    await this.storageService.saveBuffer(key, buffer, contentType);
    return { success: true, key };
  }

  @Get('file')
  async getLocalFile(
    @Query('key') key: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.serveFile(key, res);
  }

  @Get('file/*')
  async getLocalFileWildcard(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const rawPath = req.url.split('/storage/file/')[1] || '';
    const cleanKey = decodeURIComponent(rawPath.split('?')[0]);
    await this.serveFile(cleanKey, res);
  }

  private async serveFile(key: string, res: Response): Promise<void> {
    if (!key) {
      res.status(HttpStatus.BAD_REQUEST).json({
        error: { code: 'BAD_REQUEST', message: 'Query parameter "key" is required' },
      });
      return;
    }
    try {
      const buffer = await this.storageService.downloadBuffer(key);
      const ext = key.split('.').pop()?.toLowerCase();
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(buffer);
    } catch {
      res.status(HttpStatus.NOT_FOUND).json({
        error: { code: 'NOT_FOUND', message: 'File not found' },
      });
    }
  }
}
