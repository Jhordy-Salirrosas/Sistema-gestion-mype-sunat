const mockUpload = jest.fn();
const mockFrom = jest.fn(() => ({ upload: mockUpload }));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ storage: { from: mockFrom } })),
}));

import { createClient } from '@supabase/supabase-js';
import {
  sanitizarNombreArchivo,
  SIRE_BUCKET_POR_DEFECTO,
  SupabaseSireFileStorage,
} from '../../../src/modules/sire/infrastructure/storage/supabaseSireFileStorage';

describe('SupabaseSireFileStorage', () => {
  const archivo = {
    companyId: 'company-a',
    periodo: '202401',
    nombreArchivo: 'LE20601030013-RCE-202401.zip',
    contenido: Buffer.from('contenido de la propuesta'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue({ upload: mockUpload });
  });

  it('creates the client without a persistent session', () => {
    new SupabaseSireFileStorage('http://supabase.test', 'clave');

    expect(createClient).toHaveBeenCalledWith('http://supabase.test', 'clave', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  it('uploads the file and returns its route, its hash and its size', async () => {
    mockUpload.mockResolvedValue({ error: null });

    const resultado = await new SupabaseSireFileStorage(
      'http://supabase.test',
      'clave',
    ).guardar(archivo);

    expect(mockFrom).toHaveBeenCalledWith(SIRE_BUCKET_POR_DEFECTO);
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(
        /^sire\/company-a\/202401\/[0-9a-f-]+-LE20601030013-RCE-202401\.zip$/,
      ),
      archivo.contenido,
      { contentType: 'application/octet-stream', upsert: false },
    );
    expect(resultado.backend).toBe('SUPABASE');
    expect(resultado.bytes).toBe(archivo.contenido.length);
    expect(resultado.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(resultado.ruta).toMatch(
      /^sire\/company-a\/202401\/[0-9a-f-]+-LE20601030013-RCE-202401\.zip$/,
    );
  });

  it('uses the bucket that was configured', async () => {
    mockUpload.mockResolvedValue({ error: null });

    await new SupabaseSireFileStorage(
      'http://supabase.test',
      'clave',
      'sire-propio',
    ).guardar(archivo);

    expect(mockFrom).toHaveBeenCalledWith('sire-propio');
  });

  it('fails when Supabase rejects the upload', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'bucket no existe' } });

    await expect(
      new SupabaseSireFileStorage('http://supabase.test', 'clave').guardar(
        archivo,
      ),
    ).rejects.toThrow('Supabase Storage rechazó la carga: bucket no existe');
  });
});

describe('sanitizarNombreArchivo', () => {
  it('replaces the characters that are not valid in an object key', () => {
    expect(sanitizarNombreArchivo('LE 20601:30013.zip')).toBe(
      'LE_20601_30013.zip',
    );
  });

  it('reduces the characters that are not valid to a single underscore', () => {
    expect(sanitizarNombreArchivo('***')).toBe('_');
  });

  it('cuts the name to the maximum length of an object key', () => {
    expect(sanitizarNombreArchivo(`${'a'.repeat(300)}.zip`)).toHaveLength(180);
  });
});
