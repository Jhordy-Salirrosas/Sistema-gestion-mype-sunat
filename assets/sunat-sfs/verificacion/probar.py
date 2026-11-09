# Verificación funcional del juego XSL del Facturador SUNAT (SFS) bajo libxslt (lxml).
# Reproduce la prueba del 2026-11-08:
#   - factura con moneda BTC  -> la hoja se detiene con el error SUNAT 3088 (catálogo 02)
#   - factura con moneda PEN  -> supera el control de moneda y avanza a controles posteriores
# El diseño de SUNAT es fail-fast: rejectCall usa xsl:message terminate="yes";
# el primer error detiene la transformación y su texto ES el resultado de la validación.
# Adaptaciones de motor aplicadas SOLO en memoria/copia de trabajo (los .xsl del repo
# quedan byte a byte como vienen en el SFS):
#   1) validate_utils.xsl: extension-element-prefixes "dp" -> "dp func"
#   2) Hoja de Factura: current-date() (XPath 2.0) -> date:date() (EXSLT)
#   3) validate_utils.xsl: matches( (XPath 2.0) -> regexp:test( (EXSLT)
#   4) El resolver mapea local:///commons/... y sunat_archivos/sfs/VALI/commons/...
#      al árbol local; EXSLT regexp y dyn:evaluate se suplen en Python (libxslt no los trae).
import os, re, sys, tempfile, shutil
from lxml import etree

AQUI = os.path.dirname(os.path.abspath(__file__))
COMMONS_ORIG = os.path.normpath(os.path.join(AQUI, "..", "commons"))

work = tempfile.mkdtemp(prefix="sfs-vali-")
COMMONS = os.path.join(work, "VALI", "commons")
shutil.copytree(COMMONS_ORIG, COMMONS)

def parchear(path, pares):
    s = open(path, encoding="utf-8").read()
    for a, b in pares:
        s = s.replace(a, b)
    open(path, "w", encoding="utf-8").write(s)

parchear(os.path.join(COMMONS, "error", "validate_utils.xsl"), [
    ('extension-element-prefixes="dp"', 'extension-element-prefixes="dp func"'),
    ("not(matches(", "not(regexp:test("),
])
HOJA = os.path.join(COMMONS, "xsl", "validation", "2.X", "ValidaExprRegFactura-2.0.1.xsl")
parchear(HOJA, [('select="current-date()"', 'select="date:date()"')])

ns_regexp = etree.FunctionNamespace("http://exslt.org/regular-expressions")
ns_regexp.prefix = "regexp"
def _texto(v):
    if isinstance(v, list):
        if not v:
            return ""
        v = v[0]
    if isinstance(v, str):
        return v
    try:
        return v.text or ""
    except Exception:
        return str(v)
def regexp_match(context, string, pattern, flags=""):
    try:
        m = re.search(_texto(pattern), _texto(string))
        return [m.group(0)] if m else []
    except Exception:
        return []
def regexp_test(context, string, pattern, flags=""):
    try:
        return re.search(_texto(pattern), _texto(string)) is not None
    except Exception:
        return False
ns_regexp["match"] = regexp_match
ns_regexp["test"] = regexp_test

ns_dyn = etree.FunctionNamespace("http://exslt.org/dynamic")
ns_dyn.prefix = "dyn"
def dyn_evaluate(context, expr):
    node = context.context_node
    ns = {}
    el = node
    while el is not None:
        for k, v in (el.nsmap or {}).items():
            if k and k not in ns:
                ns[k] = v
        el = el.getparent()
    try:
        return node.xpath(expr, namespaces=ns)
    except Exception:
        return []
ns_dyn["evaluate"] = dyn_evaluate

class SFSResolver(etree.Resolver):
    def resolve(self, url, pubid, context):
        tail = None
        if url.startswith("local:///commons/"):
            tail = url[len("local:///commons/"):]
        elif "/VALI/commons/" in url:
            tail = url.rsplit("/VALI/commons/", 1)[1]
        elif "sunat_archivos/sfs/VALI/commons/" in url:
            tail = url.rsplit("sunat_archivos/sfs/VALI/commons/", 1)[1]
        if tail:
            path = os.path.join(COMMONS, tail)
            if os.path.exists(path):
                return self.resolve_filename(path, context)
        return None

def correr(xml_path):
    parser = etree.XMLParser(no_network=True)
    parser.resolvers.add(SFSResolver())
    transform = etree.XSLT(etree.parse(HOJA, parser))
    doc = etree.parse(xml_path)
    try:
        result = transform(doc, nombreArchivoEnviado="'20100070970-01-F001-1.xml'")
        return str(result), [e.message for e in transform.error_log]
    except Exception as ex:
        return "DETENIDO: %s" % str(ex)[:220], [e.message for e in transform.error_log]

if __name__ == "__main__":
    for nombre in ["factura_btc.xml", "factura_pen.xml"]:
        salida, log = correr(os.path.join(AQUI, nombre))
        print("=" * 25, nombre, "=" * 25)
        print(salida)
        for linea in log[-3:]:
            print("LOG:", linea.strip()[:200])
        print("3088 presente:", "3088" in salida or any("3088" in l for l in log))
