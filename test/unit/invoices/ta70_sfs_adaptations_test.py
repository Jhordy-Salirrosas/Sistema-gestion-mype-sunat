"""Invariante: el patrón autorizado solo cambia nombres, nunca reglas SUNAT."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("sfs", ROOT / "scripts/m1/validate_sfs.py")
sfs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sfs)


class AdaptacionesDuplicadas(unittest.TestCase):
    def test_solo_identificadores_y_referencias_inmediatas(self):
        # Lista independiente de las líneas examinadas en los originales.
        cambios = {"01": {4735, 4736}, "03": {5304, 5305}, "07": {81},
                   "08": {34, 1073, 1074, 1983}}
        for tipo, hoja in sfs.HOJAS.items():
            with self.subTest(tipo=tipo):
                path = sfs.ASSETS / "xsl/validation/2.X" / f"ValidaExprReg{hoja}-2.0.1.xsl"
                original = path.read_text(encoding="utf-8")
                adaptada = sfs.adaptar_duplicadas(original, tipo)
                self.assertEqual(len(original.splitlines()), len(adaptada.splitlines()))
                self.assertEqual({i for i, (a, b) in enumerate(zip(original.splitlines(), adaptada.splitlines()), 1) if a != b}, cambios[tipo])
                restaurada = adaptada
                for _, anterior, nuevo, _ in sfs.DUPLICADAS[tipo]:
                    self.assertNotIn(nuevo, original)
                    restaurada = restaurada.replace(nuevo, anterior)
                self.assertEqual(restaurada, original)
                self.assertEqual(path.read_text(encoding="utf-8"), original)

    def test_rechaza_otra_revision_de_la_hoja(self):
        with self.assertRaises(ValueError):
            sfs.adaptar_duplicadas("<xsl:stylesheet/>", "01")


if __name__ == "__main__":
    unittest.main()
