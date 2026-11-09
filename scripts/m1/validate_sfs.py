"""TA-70: protocolo JSON por stdin/stdout; los assets SUNAT nunca se escriben.

Adaptaciones de libxslt tomadas de assets/sunat-sfs/verificacion/probar.py.
Cada invocación vive en un proceso y un directorio temporal independientes.
"""
import json
from pathlib import Path
import re
import shutil
import sys
import tempfile
from lxml import etree

ASSETS = Path(__file__).resolve().parents[2] / "assets" / "sunat-sfs" / "commons"
HOJAS = {"01": "Factura", "03": "Boleta", "07": "NC", "08": "ND"}
ESQUEMAS = {"01": "Invoice", "03": "Invoice", "07": "CreditNote", "08": "DebitNote"}
CBC = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
CAC = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"


def texto(value):
    if isinstance(value, list):
        value = value[0] if value else ""
    return "".join(value.itertext()) if isinstance(value, etree._Element) else str(value)


def registrar_exslt():
    regexp = etree.FunctionNamespace("http://exslt.org/regular-expressions")
    regexp.prefix = "regexp"

    def buscar(context, string, pattern, flags=""):
        return re.search(texto(pattern), texto(string), re.I if "i" in texto(flags) else 0)

    def match(context, string, pattern, flags=""):
        found = buscar(context, string, pattern, flags)
        return [found.group(0)] if found else []

    regexp["match"] = match
    regexp["test"] = lambda c, s, p, f="": buscar(c, s, p, f) is not None
    dyn = etree.FunctionNamespace("http://exslt.org/dynamic")
    dyn.prefix = "dyn"

    def evaluate(context, expr):
        node = context.context_node
        namespaces = {}
        el = node
        while el is not None:
            for key, value in (el.nsmap or {}).items():
                if key and key not in namespaces:
                    namespaces[key] = value
            el = el.getparent()
        # No se silencian errores de motor como si fueran validaciones exitosas.
        return node.xpath(texto(expr), namespaces=namespaces)

    dyn["evaluate"] = evaluate


class Resolver(etree.Resolver):
    def __init__(self, commons):
        self.commons = commons.resolve()

    def resolve(self, url, pubid, context):
        if url.startswith("local:///commons/"):
            path = self.commons / url[len("local:///commons/"):]
        elif "/VALI/commons/" in url:
            path = self.commons / url.rsplit("/VALI/commons/", 1)[1]
        else:
            path = Path(url.removeprefix("file://"))
        path = path.resolve()
        if not path.is_relative_to(self.commons) or not path.is_file():
            raise OSError("Recurso SFS fuera del árbol local o ausente")
        return self.resolve_filename(str(path), context)


# Líneas de las hojas vendorizadas: solo identificadores y referencias locales.
# Cada instancia se documenta en docs/m1/auditoria-solucion.md.
DUPLICADAS = {
    "01": [(4735, "totalDescuentosGlobales", "totalDescuentosGlobalesInafectos", (4736,))],
    "03": [(5304, "totalDescuentosGlobales", "totalDescuentosGlobalesInafectos", (5305,))],
    "07": [(81, "tipoComprobante", "tipoComprobantePorSerie", ())],
    "08": [(34, "tipoComprobante", "tipoComprobantePorSerie", ()),
           (1073, "totalImpuestos", "totalImpuestosLocal", ()),
           (1074, "SumatoriaImpuestos", "SumatoriaImpuestosLocal", ()),
           (1983, "valorVentaLinea", "valorVentaLineaDuplicado", ())],
}


def adaptar_duplicadas(contenido, tipo):
    """Cuarta adaptación autorizada; falla si cambia la ubicación vendorizada."""
    lineas = contenido.splitlines(keepends=True)
    for numero, anterior, nuevo, referencias in DUPLICADAS[tipo]:
        atributo = f'name="{anterior}"'
        if numero > len(lineas) or lineas[numero - 1].count(atributo) != 1:
            raise ValueError("La adaptación de duplicadas no corresponde a esta hoja SFS")
        lineas[numero - 1] = lineas[numero - 1].replace(atributo, f'name="{nuevo}"')
        for referencia in referencias:
            patron = rf"\${anterior}\b"
            if not re.search(patron, lineas[referencia - 1]):
                raise ValueError("Referencia local de variable duplicada ausente")
            lineas[referencia - 1] = re.sub(patron, lambda _: f"${nuevo}", lineas[referencia - 1])
    return "".join(lineas)


def validar(request):
    tipo = request["tipo"]
    hoja = HOJAS[tipo]
    parser_xml = etree.XMLParser(no_network=True, resolve_entities=False, load_dtd=False)
    try:
        doc = etree.fromstring(request["xml"].encode("utf-8"), parser_xml)
    except etree.XMLSyntaxError:
        return {"completado": True, "errores": [{"codigo": "XSD", "mensaje": "XML mal formado", "nodo": None}]}
    if doc.getroottree().docinfo.doctype:
        raise ValueError("DTD no permitido")
    # La estructura se verifica antes de compilar o ejecutar cualquier XSL.
    parser_xsd = etree.XMLParser(no_network=True, resolve_entities=False, load_dtd=False)
    parser_xsd.resolvers.add(Resolver(ASSETS))
    schema_path = ASSETS / "xsd" / "2.1" / "maindoc" / f"UBL-{ESQUEMAS[tipo]}-2.1.xsd"
    schema = etree.XMLSchema(etree.parse(str(schema_path), parser_xsd))
    if not schema.validate(doc):
        error = schema.error_log[0]
        return {"completado": True, "errores": [{"codigo": "XSD", "mensaje": error.message, "nodo": error.path}]}
    ns = {"cbc": CBC, "cac": CAC}
    ruc = doc.findtext("cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID", namespaces=ns) or ""
    numero = doc.findtext("cbc:ID", namespaces=ns) or ""
    nombre = f"{ruc}-{tipo}-{numero}.xml"
    registrar_exslt()
    with tempfile.TemporaryDirectory(prefix="sfs-vali-") as work:
        commons = Path(work) / "VALI" / "commons"
        shutil.copytree(ASSETS, commons)
        utils = commons / "error" / "validate_utils.xsl"
        original = utils.read_text(encoding="utf-8")
        utils.write_text(original.replace('extension-element-prefixes="dp"', 'extension-element-prefixes="dp func"').replace("matches(", "regexp:test("), encoding="utf-8")
        path = commons / "xsl" / "validation" / "2.X" / f"ValidaExprReg{hoja}-2.0.1.xsl"
        contenido = path.read_text(encoding="utf-8").replace("current-date()", "date:date()")
        contenido = adaptar_duplicadas(contenido, tipo)
        path.write_text(contenido, encoding="utf-8")
        parser = etree.XMLParser(no_network=True, resolve_entities=False, load_dtd=False)
        parser.resolvers.add(Resolver(commons))
        transform = etree.XSLT(etree.parse(str(path), parser), access_control=etree.XSLTAccessControl(read_file=True, read_network=True, write_file=False, write_network=False, create_dir=False))
        try:
            transform(doc, nombreArchivoEnviado=etree.XSLT.strparam(nombre))
        except etree.XSLTApplyError:
            # Solo rejectCall del SFS acredita un rechazo. Un fallo XPath,
            # include, catálogo o función ausente es un fallo del ejecutor.
            if any(e.message.startswith("runtime error") for e in transform.error_log):
                raise
            fatal = [e.message.strip() for e in transform.error_log if e.message.strip().startswith("error:")]
            if not fatal:
                raise
            mensaje = fatal[0]
            codigo = re.search(r"\berrorCode\s+(\d{4})\b", mensaje)
            if not codigo:
                raise
            nodo = re.search(r'nodo:\s*"([^"]*)"', mensaje)
            return {"completado": True, "errores": [{"codigo": codigo[1], "mensaje": mensaje, "nodo": nodo[1] if nodo else None}]}
        return {"completado": True, "errores": []}


if __name__ == "__main__":
    try:
        print(json.dumps(validar(json.load(sys.stdin)), ensure_ascii=False))
    except Exception:
        # No volcar XML ni datos tributarios en stderr/logs del servicio.
        print(json.dumps({"completado": False, "motivo": "No se pudo completar el ejecutor SFS"}))
        sys.exit(1)
