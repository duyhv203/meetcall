import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private readonly bucket: string;
  private readonly localStorageDir: string;
  private readonly isS3Configured: boolean;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('S3_BUCKET', '');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID', '');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY', '');
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    const endpoint = this.configService.get<string>('S3_ENDPOINT', '');

    this.localStorageDir = path.resolve(process.cwd(), 'uploads');
    this.isS3Configured = Boolean(this.bucket && accessKeyId && secretAccessKey);

    if (this.isS3Configured) {
      this.s3Client = new S3Client({
        region,
        endpoint: endpoint || undefined,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: Boolean(endpoint),
      });
      this.logger.log(`Initialized S3 storage with bucket: ${this.bucket}`);
    } else {
      this.logger.log('S3 not configured. Using local filesystem storage for uploads.');
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.isS3Configured) {
      await fs.mkdir(this.localStorageDir, { recursive: true });
    }
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 300,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    if (this.isS3Configured && this.s3Client) {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      const publicUrl = this.configService.get<string>(
        'S3_PUBLIC_URL',
        `https://${this.bucket}.s3.amazonaws.com/${key}`,
      );

      return { uploadUrl, publicUrl };
    }

    // Local / Cloud disk mode: generate endpoint URL
    const port = this.configService.get<number>('PORT', 3000);
    const apiPrefix = this.configService.get<string>('API_PREFIX', '/api/v1');
    const externalApiUrl =
      this.configService.get<string>('API_URL') ||
      this.configService.get<string>('RENDER_EXTERNAL_URL');
    const baseUrl = externalApiUrl
      ? externalApiUrl.replace(/\/$/, '')
      : `http://localhost:${port}`;
    const uploadUrl = `${baseUrl}${apiPrefix}/storage/upload?key=${encodeURIComponent(key)}`;
    const publicUrl = `${baseUrl}${apiPrefix}/storage/file?key=${encodeURIComponent(key)}`;

    return { uploadUrl, publicUrl };
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    if (this.isS3Configured && this.s3Client) {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      const response = await this.s3Client.send(command);
      const byteArray = await response.Body?.transformToByteArray();
      if (!byteArray) {
        throw new Error(`File not found in S3: ${key}`);
      }
      return Buffer.from(byteArray);
    }

    const filePath = path.join(this.localStorageDir, key);
    return fs.readFile(filePath);
  }

  async saveBuffer(key: string, buffer: Buffer, contentType: string): Promise<string> {
    if (this.isS3Configured && this.s3Client) {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });
      await this.s3Client.send(command);
      return this.configService.get<string>(
        'S3_PUBLIC_URL',
        `https://${this.bucket}.s3.amazonaws.com/${key}`,
      );
    }

    const filePath = path.join(this.localStorageDir, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);

    const port = this.configService.get<number>('PORT', 3000);
    const apiPrefix = this.configService.get<string>('API_PREFIX', '/api/v1');
    const externalApiUrl =
      this.configService.get<string>('API_URL') ||
      this.configService.get<string>('RENDER_EXTERNAL_URL');
    const baseUrl = externalApiUrl
      ? externalApiUrl.replace(/\/$/, '')
      : `http://localhost:${port}`;
    return `${baseUrl}${apiPrefix}/storage/file/${encodeURIComponent(key)}`;
  }

  async deleteFile(key: string): Promise<void> {
    if (this.isS3Configured && this.s3Client) {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3Client.send(command);
      return;
    }

    const filePath = path.join(this.localStorageDir, key);
    await fs.unlink(filePath).catch(() => {});
  }
}
