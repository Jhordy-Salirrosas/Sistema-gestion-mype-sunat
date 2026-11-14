import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalSireFileStorage } from '../../../src/modules/sire/infrastructure/storage/localSireFileStorage';
import {
  construirRutaSire,
  sanitizarNombreArchivo,
} from '../../../src/modules/sire/infrastructure/storage/supabaseSireFileStorage';
import {
  crearAlmacenamientoLocal,
  crearSireFileStorage,
  ResilientSireFileStorage,
} from '../../../src/modules/sire/infrastructure/storage/sireFileStorageSelector';
import type { SireFileStoragePort } from '../../../src/modules/sire/domain/ports/sireFileStoragePort';

describe('almacenamiento de archivos SIRE', () => {
  describe('sanitizarNombreArchivo', () => {
    it('removes the characters that are not valid in an object key', () => {
      expect(sanitizarNombreArchivo('LE20601030013 RCE 202401.zip')).toBe(
        'LE20601030013_RCE_202401.zip',
      );
    });

    it('drops any path that comes with the name', () => {
      expect(sanitizarNombreArchivo('carpeta/LE20601030013.zip')).toBe(
        'LE20601030013.zip',
      );
    });
  });

  describe('construirRutaSire', () => {
    it('orders the file by company and period', () => {
      expect(
        construirRutaSire('company-a', '202401', 'LE20601030013.zip', 'token'),
      ).toBe('sire/company-a/202401/token-LE20601030013.zip');
    });
  });

  describe('LocalSireFileStorage', () => {
    it('writes the file and returns its hash and its route', async () => {
      const carpeta = await mkdtemp(join(tmpdir(), 'sire-test-'));
      const storage = new LocalSireFileStorage(carpeta);
      const contenido = Buffer.from('contenido de la propuesta');

      const resultado = await storage.guardar({
        companyId: 'company-a',
        periodo: '202401',
        nombreArchivo: 'LE20601030013-RCE-202401.zip',
        contenido,
      });

      expect(resultado.backend).toBe('LOCAL');
      expect(resultado.bytes).toBe(contenido.length);
      expect(resultado.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(await readFile(resultado.ruta, 'utf8')).toBe('contenido de la propuesta');
    });
  });

  describe('ResilientSireFileStorage', () => {
    const archivo = {
      companyId: 'company-a',
      periodo: '202401',
      nombreArchivo: 'LE20601030013-RCE-202401.zip',
      contenido: Buffer.from('contenido'),
    };

    it('uses the primary storage when it works', async () => {
      const principal: SireFileStoragePort = {
        guardar: jest.fn().mockResolvedValue({
          ruta: 'ruta',
          hash: 'hash',
          backend: 'SUPABASE',
          bytes: 8,
        }),
      };
      const respaldo: SireFileStoragePort = {
        guardar: jest.fn(),
      };

      const resultado = await new ResilientSireFileStorage(
        principal,
        respaldo,
      ).guardar(archivo);

      expect(resultado.backend).toBe('SUPABASE');
      expect(respaldo.guardar).not.toHaveBeenCalled();
    });

    it('falls back to the local storage when the primary one fails', async () => {
      const principal: SireFileStoragePort = {
        guardar: jest.fn().mockRejectedValue(new Error('bucket no existe')),
      };
      const respaldo: SireFileStoragePort = {
        guardar: jest.fn().mockResolvedValue({
          ruta: 'ruta-local',
          hash: 'hash',
          backend: 'LOCAL',
          bytes: 8,
        }),
      };

      const resultado = await new ResilientSireFileStorage(
        principal,
        respaldo,
      ).guardar(archivo);

      expect(resultado.backend).toBe('LOCAL');
      expect(respaldo.guardar).toHaveBeenCalled();
    });

    it('uses the local storage when there is no primary one', async () => {
      const respaldo: SireFileStoragePort = {
        guardar: jest.fn().mockResolvedValue({
          ruta: 'ruta-local',
          hash: 'hash',
          backend: 'LOCAL',
          bytes: 8,
        }),
      };

      const resultado = await new ResilientSireFileStorage(
        null,
        respaldo,
      ).guardar(archivo);

      expect(resultado.backend).toBe('LOCAL');
    });

    it('reports the reason of the fallback to the caller', async () => {
      const principal: SireFileStoragePort = {
        guardar: jest.fn().mockRejectedValue(new Error('bucket no existe')),
      };
      const respaldo: SireFileStoragePort = {
        guardar: jest.fn().mockResolvedValue({
          ruta: 'ruta-local',
          hash: 'hash',
          backend: 'LOCAL',
          bytes: 8,
        }),
      };
      const alFallar = jest.fn();

      await new ResilientSireFileStorage(principal, respaldo, alFallar).guardar(
        archivo,
      );

      expect(alFallar).toHaveBeenCalledWith(
        expect.stringContaining('bucket no existe'),
      );
    });

    it('reports the reason of the fallback even when it is not an error', async () => {
      const principal: SireFileStoragePort = {
        guardar: jest.fn().mockRejectedValue('fallo sin.Error'),
      };
      const respaldo: SireFileStoragePort = {
        guardar: jest.fn().mockResolvedValue({
          ruta: 'ruta-local',
          hash: 'hash',
          backend: 'LOCAL',
          bytes: 8,
        }),
      };
      const alFallar = jest.fn();

      await new ResilientSireFileStorage(principal, respaldo, alFallar).guardar(
        archivo,
      );

      expect(alFallar).toHaveBeenCalledWith(
        expect.stringContaining('fallo sin.Error'),
      );
    });
  });

  describe('crearSireFileStorage', () => {
    it('goes straight to the local storage when Supabase is not configured', async () => {
      const storage = crearSireFileStorage({} as NodeJS.ProcessEnv);
      const carpeta = await mkdtemp(join(tmpdir(), 'sire-test-'));

      const resultado = await storage.guardar({
        companyId: 'company-a',
        periodo: '202401',
        nombreArchivo: 'LE20601030013-RCE-202401.zip',
        contenido: Buffer.from('contenido'),
      });

      expect(resultado.backend).toBe('LOCAL');
      expect(carpeta).toEqual(expect.any(String));
    });

    it('uses Supabase as the primary storage when it is configured', () => {
      const storage = crearSireFileStorage({
        SUPABASE_URL: 'http://supabase.test',
        SUPABASE_KEY: 'clave',
        SUPABASE_STORAGE_BUCKET: 'sire-propio',
      } as NodeJS.ProcessEnv);

      const principal = (
        storage as unknown as { principal: unknown }
      ).principal;

      expect(principal).not.toBeNull();
      expect(principal).toBeDefined();
    });

    it('ignores a Supabase configuration that is incomplete', () => {
      const storage = crearSireFileStorage({
        SUPABASE_URL: 'http://supabase.test',
        SUPABASE_KEY: '   ',
      } as NodeJS.ProcessEnv);

      const principal = (
        storage as unknown as { principal: unknown }
      ).principal;

      expect(principal).toBeNull();
    });
  });

  describe('crearAlmacenamientoLocal', () => {
    it('uses the configured folder', async () => {
      const carpeta = await mkdtemp(join(tmpdir(), 'sire-test-'));

      const storage = crearAlmacenamientoLocal({
        SIRE_STORAGE_LOCAL_DIR: carpeta,
      } as NodeJS.ProcessEnv);

      const resultado = await storage.guardar({
        companyId: 'company-a',
        periodo: '202401',
        nombreArchivo: 'LE20601030013-RCE-202401.zip',
        contenido: Buffer.from('contenido'),
      });

      expect(resultado.backend).toBe('LOCAL');
      expect(resultado.ruta.startsWith(carpeta)).toBe(true);
    });

    it('falls back to the default folder when none was configured', async () => {
      const storage = crearAlmacenamientoLocal({} as NodeJS.ProcessEnv);

      expect(storage).toBeInstanceOf(LocalSireFileStorage);
    });
  });
});
