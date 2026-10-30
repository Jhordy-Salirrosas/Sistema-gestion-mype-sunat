import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface ParsePleResult {
  bookCode: string;
  totalEntriesProcessed: number;
  fileHash: string;
  status: string;
}

@Injectable()
export class ParsePleFileUseCase {
  async execute(fileBuffer: Buffer, fileName: string, _companyId: string): Promise<ParsePleResult> {
    // 1. Validar Nomenclatura del Nombre del Archivo (33 caracteres + '.txt' = 37 caracteres)
    if (!fileName || fileName.length !== 37 || !fileName.endsWith('.txt')) {
      throw new BadRequestException(
        `Nomenclatura de archivo inválida. Debe tener exactamente 33 caracteres + '.txt' (Recibido: ${fileName})`
      );
    }

    // Extraer Código de Libro (posiciones 13 a 18 -> Ej: 050100 Diario, 060100 Mayor)
    const bookCode = fileName.substring(13, 19);
    if (!['050100', '060100'].includes(bookCode)) {
      throw new BadRequestException(
        `Código de libro '${bookCode}' no soportado. Debe ser 050100 (Diario) o 060100 (Mayor).`
      );
    }

    // 2. Hash SHA-256 anti-duplicados
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 3. Procesar Contenido por Líneas delimitadas por |
    const content = fileBuffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

    for (let i = 0; i < lines.length; i++) {
      const fields = lines[i].split('|');
      if (fields.length < 8) {
        throw new BadRequestException(`Estructura inválida en la fila ${i + 1} para el libro ${bookCode}`);
      }
    }

    return {
      bookCode,
      totalEntriesProcessed: lines.length,
      fileHash,
      status: 'PROCESSED_SUCCESSFULLY',
    };
  }
}