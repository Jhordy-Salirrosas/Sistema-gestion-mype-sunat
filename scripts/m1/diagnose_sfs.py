"""Diagnóstico local sin documento ni transporte. Salida cerrada y sanitizada."""
import json
from pathlib import Path


def diagnosticar():
    try:
        from lxml import etree
    except ImportError:
        return {"disponible": False, "causa": "SFS_LXML_AUSENTE"}
    assets = Path(__file__).resolve().parents[2] / 'assets' / 'sunat-sfs' / 'commons'
    required = [assets / 'error' / 'validate_utils.xsl']
    required += [assets / 'xsl' / 'validation' / '2.X' / f'ValidaExprReg{tipo}-2.0.1.xsl' for tipo in ['Factura', 'Boleta', 'NC', 'ND']]
    required += [assets / 'xsd' / '2.1' / 'maindoc' / f'UBL-{tipo}-2.1.xsd' for tipo in ['Invoice', 'CreditNote', 'DebitNote']]
    if any(not p.is_file() for p in required):
        return {"disponible": False, "causa": "SFS_ASSETS_AUSENTES"}
    try:
        from validate_sfs import Resolver
        parser = etree.XMLParser(no_network=True, resolve_entities=False, load_dtd=False)
        parser.resolvers.add(Resolver(assets))
        for path in required[-3:]:
            etree.XMLSchema(etree.parse(str(path), parser))
        # Prueba positiva y negativa: importar/compilar sin validar no basta.
        schema = etree.XMLSchema(etree.fromstring(b'<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="prueba" type="xs:integer"/></xs:schema>'))
        if not schema.validate(etree.fromstring(b'<prueba>1</prueba>')) or schema.validate(etree.fromstring(b'<prueba>invalido</prueba>')):
            raise ValueError()
    except Exception:
        return {"disponible": False, "causa": "SFS_XSD_NO_OPERATIVO"}
    return {"disponible": True, "causa": None}


if __name__ == '__main__':
    print(json.dumps(diagnosticar()))
