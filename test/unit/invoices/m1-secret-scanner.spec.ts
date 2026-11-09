const { scanText, scanFile } = require('../../../scripts/check-secrets');

it('detecta contenido privado incrustado en código aunque el nombre parezca inocuo', () => {
 const pem = ['-----BEGIN PRIVATE KEY-----', 'A'.repeat(80), '-----END PRIVATE KEY-----'].join('\n');
 expect(scanFile('src/normal.ts', pem)).toEqual(['clave privada']);
 expect(scanText(pem.replaceAll('\n', '\\n'))).toEqual(['clave privada']);
});
it('detecta tokens y asignaciones de secretos sin devolver los valores', () => {
 const token = ['ghp_', 'a'.repeat(36)].join('');
 const value = 'sensitive-fixture-value';
 const r = scanText(`${token}\nSUNAT_SOL_PASSWORD=${value}`);
 expect(r).toEqual(['token de acceso', 'asignación literal de secreto']);
 expect(JSON.stringify(r)).not.toContain(value); expect(JSON.stringify(r)).not.toContain(token);
 expect(scanText(['AKIA', 'A'.repeat(16)].join(''))).toEqual(['token de acceso']);
});
it.each(['', '""', '${SOL_PASSWORD}', '<SET_SECRET>', 'CHANGE_ME', 'YOUR_SECRET', 'FAKE_PASSWORD'])('permite marcadores explícitos %s', (value) => {
 expect(scanText(`SUNAT_SOL_PASSWORD=${value}`)).toEqual([]);
});
it('mantiene la detección por nombre y no confunde llamadas a variables con secretos literales', () => {
 expect(scanFile('.env', '')).toContain('archivo de entorno privado');
 expect(scanFile('issuer.p12', '')).toContain('archivo criptográfico');
 expect(scanText('const password = process.env.SUNAT_SOL_PASSWORD;')).toEqual([]);
 expect(scanFile('.env.example', 'SUNAT_ENV=BETA')).toEqual([]);
});
