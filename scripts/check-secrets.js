const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');

/** Devuelve categorías, nunca valores ni fragmentos del secreto. */
function scanText(contents) {
  const findings = [];
  if (/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----\s*(?:[A-Za-z0-9+/=\s]|\\n|\\r){64,}-----END (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/.test(contents)) findings.push('clave privada');
  if (/\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{80,}|AKIA[A-Z0-9]{16})\b/.test(contents)) findings.push('token de acceso');
  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?(?:SUNAT_SOL_PASSWORD|CERT_PASSWORD|CERT_BASE64|ISSUER_CONFIG_ENCRYPTION_KEY)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[1].trim().replace(/^(['"])(.*)\1$/, '$2');
    if (value && !/^(?:\$\{[^}]+\}|<[^>]+>|(?:CHANGE_ME|REPLACE_ME|YOUR_|TU_|FAKE_|OBVIOUSLY_FAKE_|GENERATE_).*)$/i.test(value)) findings.push('asignación literal de secreto');
  }
  return [...new Set(findings)];
}
function scanFile(file, contents) {
  const findings = scanText(contents);
  if (['.pfx', '.p12', '.jks', '.pem', '.key'].includes(path.extname(file).toLowerCase())) findings.push('archivo criptográfico');
  if (['.env', '.env.local', '.env.development', '.env.production'].includes(path.basename(file))) findings.push('archivo de entorno privado');
  return [...new Set(findings)];
}
function main() {
  try {
    const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
    let failed = false;
    for (const file of files) {
      const findings = scanFile(file, readFileSync(file, 'utf8'));
      if (findings.length) { console.error(`${file}: ${findings.join(', ')}`); failed = true; }
    }
    if (failed) { console.error('Revisión requerida: coincidencias en archivos rastreados. No se muestran valores.'); return 1; }
    console.log('Sin coincidencias en los patrones revisados; este control no garantiza ausencia de otros secretos.');
    return 0;
  } catch { console.error('No se pudo completar la revisión de archivos rastreados.'); return 1; }
}
module.exports = { scanText, scanFile, main };
if (require.main === module) process.exitCode = main();
