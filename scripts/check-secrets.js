const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Escaneando archivos rastreados por Git en busca de secretos...');

try {
    // Obtenemos solo los archivos que Git está rastreando (para ignorar tu .env local)
    const output = execSync('git ls-files', { encoding: 'utf-8' });
    const files = output.split('\n').filter(Boolean);

    const forbiddenExtensions = ['.pfx', '.p12', '.jks', '.pem', '.key'];
    const forbiddenExactFiles = ['.env', '.env.local', '.env.development', '.env.production'];

    let secretsFound = false;

    for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        const basename = path.basename(file);

        if (forbiddenExtensions.includes(ext)) {
            console.error(`❌ SECRETO DETECTADO EN GIT: Archivo de certificado encontrado -> ${file}`);
            secretsFound = true;
        }

        if (forbiddenExactFiles.includes(basename)) {
            console.error(`❌ SECRETO DETECTADO EN GIT: Archivo de entorno encontrado -> ${file}`);
            secretsFound = true;
        }
    }

    if (secretsFound) {
        console.error('\n🚨 ESCANEO FALLIDO: Se encontraron secretos que no deben estar versionados en Git.');
        process.exit(1); // Falla el proceso (detiene el PR en Github Actions)
    } else {
        console.log('\n✅ ESCANEO EXITOSO: Tu repositorio está limpio de secretos.');
        process.exit(0); // Proceso exitoso
    }
} catch (error) {
    console.error('Error al ejecutar git ls-files. Asegúrate de estar en un repositorio git.', error.message);
    process.exit(1);
}
