import { Module } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { SignatureService } from './signature.service';

@Module({
  providers: [CertificateService, SignatureService],
  exports: [CertificateService, SignatureService],
})
export class SunatModule {}