import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import {
  Badge,
  Card,
  Input,
  Page,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { accountingApi } from '../services/accountingApi';
import type { AccountingAccount } from '../types/accounting.types';

/**
 * Plan de cuentas que usa el módulo de facturación.
 *
 * POR QUÉ ESTAS Y NO OTRAS
 *
 * Las cuatro filas anteriores (`121101`, `401111`, `601101`, `701111`) no eran
 * del PCGE: tenían un dígito de más y no coincidían con ninguna cuenta del
 * asiento real, así que la pantalla mostraba un catálogo que no se usaba en
 * ninguna parte.
 *
 * Esta lista sale de dos fuentes verificables, no de memoria:
 *
 *  - las cuentas que asigna `accountingBridge.ts` al asentar una venta
 *    (12121, 12129, 40111, 40114, 70121, 70321, 70521, 74111);
 *  - las cuentas que realmente aparecen en `accounting_lines` de la base de
 *    datos (12121, 1212, 40111, 70121).
 *
 * Se incluyen además las de compras y gastos porque completan los elementos 1,
 * 2, 4, 6 y 7 que el docente pidió ver: "tenemos las 70, 40, 12... y tiene su
 * subdivisionaria".
 */

interface TreeNode extends AccountingAccount {
  children: TreeNode[];
}

function buildTree(accounts: AccountingAccount[]): TreeNode[] {
  const byCode = new Map<string, TreeNode>();
  accounts.forEach((account) => byCode.set(account.code, { ...account, children: [] }));
  const roots: TreeNode[] = [];
  byCode.forEach((node) => {
    if (node.parentCode && byCode.has(node.parentCode)) {
      byCode.get(node.parentCode)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export default function AccountingPlanCuentasPage() {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9']));

  const { data: accounts = [], isLoading, error } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => accountingApi.getAccounts(),
  });

  const tree = useMemo(() => buildTree(accounts), [accounts]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return null;
    return accounts.filter(
      (account) =>
        account.code.toLowerCase().includes(term) ||
        account.name.toLowerCase().includes(term),
    );
  }, [accounts, search]);

  const toggle = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const renderRow = (node: TreeNode, depth: number): React.ReactNode[] => {
    const isOpen = expanded.has(node.code);
    const hasChildren = node.children.length > 0;
    const rows: React.ReactNode[] = [
      <TableRow key={node.code}>
        <TableCell>
          <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 18}px` }}>
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggle(node.code)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={isOpen ? `Contraer ${node.code}` : `Expandir ${node.code}`}
              >
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-4" />
            )}
            <span className="font-mono font-bold">{node.code}</span>
          </div>
        </TableCell>
        <TableCell className={node.level <= 2 ? 'font-semibold' : ''}>{node.name}</TableCell>
        <TableCell>{node.element}</TableCell>
        <TableCell align="center">
          <Badge variant={node.nature === 'Deudora' ? 'secondary' : 'outline'}>{node.nature}</Badge>
        </TableCell>
        <TableCell align="center">{node.children.length || '—'}</TableCell>
        <TableCell align="center">
          <Badge variant={node.isActive ? 'outline' : 'secondary'}>
            {node.isActive ? 'Activa' : 'Inactiva'}
          </Badge>
        </TableCell>
      </TableRow>,
    ];
    if (isOpen) {
      node.children.forEach((child) => rows.push(...renderRow(child, depth + 1)));
    }
    return rows;
  };

  return (
    <Page>
      <PageHeader
        title="Plan Contable General Empresarial (PCGE 2019)"
        description={`${accounts.length} cuentas cargadas · jerarquía por elemento, cuenta y subcuenta`}
      />

      <Card className="mb-4">
        <div className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por código o nombre de cuenta"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((element) => (
              <Badge key={element} variant="outline">
                Elemento {element}: {accounts.filter((account) => account.code.startsWith(element)).length}
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      {error ? (
        <Card className="p-6 text-sm text-destructive">
          No se pudo cargar el plan de cuentas. Revisa la sesión y la conexión con el backend.
        </Card>
      ) : (
        <Card flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código PCGE</TableHead>
                <TableHead>Denominación de la cuenta</TableHead>
                <TableHead>Elemento</TableHead>
                <TableHead align="center">Naturaleza</TableHead>
                <TableHead align="center">Subcuentas</TableHead>
                <TableHead align="center">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6}>Cargando catálogo PCGE…</TableCell>
                </TableRow>
              ) : filtered ? (
                filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>No hay cuentas que coincidan con la búsqueda.</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((account) => (
                    <TableRow key={account.code}>
                      <TableCell className="font-mono font-bold">{account.code}</TableCell>
                      <TableCell>{account.name}</TableCell>
                      <TableCell>{account.element}</TableCell>
                      <TableCell align="center">
                        <Badge variant={account.nature === 'Deudora' ? 'secondary' : 'outline'}>
                          {account.nature}
                        </Badge>
                      </TableCell>
                      <TableCell align="center">—</TableCell>
                      <TableCell align="center">
                        <Badge variant={account.isActive ? 'outline' : 'secondary'}>
                          {account.isActive ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )
              ) : (
                tree.flatMap((node) => renderRow(node, 0))
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </Page>
  );
}
