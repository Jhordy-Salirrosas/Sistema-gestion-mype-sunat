import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
// 1. El Base64 "que llegó de SUNAT" (pega aquí el que generaste, entre comillas)
const base64 = 'UEsDBBQAAAgIALUeQl2OWkSLAgEAAF4CAAAbAAAAUi0yMDA1MDQyMjAwMC0wMS1GMDAxLTEueG1snZJBasNADEX3PsXgdV3bXZXBdkgTAoWuSnsARVacAY80jOyS4xfjpMRpNu326euJD6pWJ9+bL4rqhOu0fCxSQ4zSOu7q9PNjlz2nqyapINp1CL1DGJzwO2kQVkqMOfme1UKs0zGyFVCnlsGTWg2E7nDesOO+t4pH8mBP2t6TZU/pjw8B/yjciPfC666L1MFAG/FBmHjQhXb/P+0LqMOFskmMqRDQbgVHTzxcWkyD82iJJrif4IEiMdLrttkVRZmVVX7Ll/lZspGWmuKSvWLX4S0pRhemIs0bmB3gMEYwPHqKYuZzD+YIRl0rBpDCAC3M0uvduUN+W2ImvxtX+f33aL4BUEsBAhQKFAAACAgAtR5CXY5aRIsCAQAAXgIAABsAAAAAAAAAAAAAAKSBAAAAAFItMjAwNTA0MjIwMDAtMDEtRjAwMS0xLnhtbFBLBQYAAAAAAQABAEkAAAA7AQAAAAA=';

// 2. Base64 -> Buffer
const zipBuffer = Buffer.from(base64, 'base64');

// 3. Abrir el ZIP en memoria
const zip = new AdmZip(zipBuffer);

// 4. Listar los archivos que trae el ZIP
const entradas = zip.getEntries();
console.log('Archivos dentro del ZIP:');
for (const entrada of entradas) {
  console.log(' -', entrada.entryName);
}

// 5. Buscar el archivo XML
const archivoXml = entradas.find((entrada) => entrada.entryName.endsWith('.xml'));

if (!archivoXml) {
  throw new Error('El ZIP no contiene ningún archivo .xml');
}

// 6. Descomprimir el XML y convertirlo a texto
const xml = archivoXml.getData().toString('utf8');
console.log('\nContenido del XML:');
console.log(xml);

// 7. Convertir el texto XML en un objeto de JavaScript
const parser = new XMLParser({
  removeNSPrefix: true,
  parseTagValue: false,
});
const cdr = parser.parse(xml);

// 8. Navegar hasta el nodo de respuesta
const respuesta = cdr.ApplicationResponse.DocumentResponse.Response;

console.log('\nNodo de respuesta del CDR:');
console.log(respuesta);
console.log('\nCódigo de respuesta:', respuesta.ResponseCode);