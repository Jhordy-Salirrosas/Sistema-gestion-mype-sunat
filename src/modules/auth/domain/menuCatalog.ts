/** Los 72 usos RoleProtectedRoute de front dcf7864b, no el número de arrays del sidebar. */
export interface MenuDefinition { code: string; moduleCode: string; path: string; roles: readonly string[]; parentCode: string | null; sourceLine: number; reservedAdmin: boolean }
export const MENU_CATALOG: readonly MenuDefinition[] = [
  {
    "code": "MENU_INVOICES_DASHBOARD",
    "moduleCode": "M1",
    "path": "/invoices/dashboard",
    "roles": [
      "ADMIN",
      "OPERADOR_FACTURACION",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 126,
    "reservedAdmin": false
  },
  {
    "code": "MENU_INVOICES_DETRACCIONES",
    "moduleCode": "M1",
    "path": "/invoices/detracciones",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 134,
    "reservedAdmin": false
  },
  {
    "code": "MENU_INVOICES_REPORTES_VENTAS",
    "moduleCode": "M1",
    "path": "/invoices/reportes/ventas",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 142,
    "reservedAdmin": false
  },
  {
    "code": "MENU_INVOICES_FACTURAS",
    "moduleCode": "M1",
    "path": "/invoices/facturas",
    "roles": [
      "ADMIN",
      "OPERADOR_FACTURACION",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 150,
    "reservedAdmin": false
  },
  {
    "code": "MENU_INVOICES_CLIENTES",
    "moduleCode": "M1",
    "path": "/invoices/clientes",
    "roles": [
      "ADMIN",
      "OPERADOR_FACTURACION",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 158,
    "reservedAdmin": false
  },
  {
    "code": "MENU_INVOICES_EMISION",
    "moduleCode": "M1",
    "path": "/invoices/emision",
    "roles": [
      "ADMIN",
      "OPERADOR_FACTURACION"
    ],
    "parentCode": null,
    "sourceLine": 165,
    "reservedAdmin": false
  },
  {
    "code": "MENU_INVOICES_NOTAS",
    "moduleCode": "M1",
    "path": "/invoices/notas",
    "roles": [
      "ADMIN",
      "OPERADOR_FACTURACION",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 175,
    "reservedAdmin": false
  },
  {
    "code": "MENU_INVOICES_BAJAS",
    "moduleCode": "M1",
    "path": "/invoices/bajas",
    "roles": [
      "ADMIN",
      "OPERADOR_FACTURACION",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 185,
    "reservedAdmin": false
  },
  {
    "code": "MENU_INVOICES_MONITOR",
    "moduleCode": "M1",
    "path": "/invoices/monitor",
    "roles": [
      "ADMIN",
      "OPERADOR_FACTURACION",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 195,
    "reservedAdmin": false
  },
  {
    "code": "MENU_INVOICES_CONFIGURACION",
    "moduleCode": "M1",
    "path": "/invoices/configuracion",
    "roles": [
      "ADMIN"
    ],
    "parentCode": null,
    "sourceLine": 211,
    "reservedAdmin": false
  },
  {
    "code": "MENU_INVOICES_CONFIGURACION_PRECIOS",
    "moduleCode": "M1",
    "path": "/invoices/configuracion/precios",
    "roles": [
      "ADMIN"
    ],
    "parentCode": "MENU_INVOICES_CONFIGURACION",
    "sourceLine": 217,
    "reservedAdmin": false
  },
  {
    "code": "MENU_USUARIOS_ALMACENES",
    "moduleCode": "M9",
    "path": "/usuarios/almacenes",
    "roles": [
      "ADMIN"
    ],
    "parentCode": null,
    "sourceLine": 218,
    "reservedAdmin": true
  },
  {
    "code": "MENU_USUARIOS_PERMISOS",
    "moduleCode": "M9",
    "path": "/usuarios/permisos",
    "roles": [
      "ADMIN"
    ],
    "parentCode": null,
    "sourceLine": 219,
    "reservedAdmin": true
  },
  {
    "code": "MENU_SALES",
    "moduleCode": "M7",
    "path": "/sales",
    "roles": [
      "ADMIN",
      "OPERADOR_FACTURACION"
    ],
    "parentCode": null,
    "sourceLine": 220,
    "reservedAdmin": false
  },
  {
    "code": "MENU_SALES_POS",
    "moduleCode": "M7",
    "path": "/sales/pos",
    "roles": [
      "ADMIN",
      "OPERADOR_FACTURACION"
    ],
    "parentCode": "MENU_SALES",
    "sourceLine": 221,
    "reservedAdmin": false
  },
  {
    "code": "MENU_SALES_HISTORIAL",
    "moduleCode": "M7",
    "path": "/sales/historial",
    "roles": [
      "ADMIN",
      "OPERADOR_FACTURACION",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_SALES",
    "sourceLine": 222,
    "reservedAdmin": false
  },
  {
    "code": "MENU_SALES_DEVOLUCIONES",
    "moduleCode": "M7",
    "path": "/sales/devoluciones",
    "roles": [
      "ADMIN",
      "OPERADOR_FACTURACION",
      "CONTADOR"
    ],
    "parentCode": "MENU_SALES",
    "sourceLine": 223,
    "reservedAdmin": false
  },
  {
    "code": "MENU_SALES_COTIZACIONES",
    "moduleCode": "M7",
    "path": "/sales/cotizaciones",
    "roles": [
      "ADMIN",
      "OPERADOR_FACTURACION"
    ],
    "parentCode": "MENU_SALES",
    "sourceLine": 224,
    "reservedAdmin": false
  },
  {
    "code": "MENU_SALES_PEDIDOS",
    "moduleCode": "M7",
    "path": "/sales/pedidos",
    "roles": [
      "ADMIN",
      "OPERADOR_FACTURACION"
    ],
    "parentCode": "MENU_SALES",
    "sourceLine": 225,
    "reservedAdmin": false
  },
  {
    "code": "MENU_SALES_CAJA",
    "moduleCode": "M7",
    "path": "/sales/caja",
    "roles": [
      "ADMIN",
      "OPERADOR_FACTURACION"
    ],
    "parentCode": "MENU_SALES",
    "sourceLine": 226,
    "reservedAdmin": false
  },
  {
    "code": "MENU_SALES_REPORTES",
    "moduleCode": "M7",
    "path": "/sales/reportes",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_SALES",
    "sourceLine": 227,
    "reservedAdmin": false
  },
  {
    "code": "MENU_CUSTOMS",
    "moduleCode": "M2",
    "path": "/customs",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 233,
    "reservedAdmin": false
  },
  {
    "code": "MENU_CUSTOMS_DASHBOARD",
    "moduleCode": "M2",
    "path": "/customs/dashboard",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_CUSTOMS",
    "sourceLine": 243,
    "reservedAdmin": false
  },
  {
    "code": "MENU_CUSTOMS_ORDERS",
    "moduleCode": "M2",
    "path": "/customs/orders",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_CUSTOMS",
    "sourceLine": 253,
    "reservedAdmin": false
  },
  {
    "code": "MENU_CUSTOMS_SUPPLIERS",
    "moduleCode": "M2",
    "path": "/customs/suppliers",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_CUSTOMS",
    "sourceLine": 263,
    "reservedAdmin": false
  },
  {
    "code": "MENU_CUSTOMS_PARTNERS",
    "moduleCode": "M2",
    "path": "/customs/partners",
    "roles": [
      "ADMIN"
    ],
    "parentCode": "MENU_CUSTOMS",
    "sourceLine": 273,
    "reservedAdmin": false
  },
  {
    "code": "MENU_CUSTOMS_CONFIG",
    "moduleCode": "M2",
    "path": "/customs/config",
    "roles": [
      "ADMIN"
    ],
    "parentCode": "MENU_CUSTOMS",
    "sourceLine": 281,
    "reservedAdmin": false
  },
  {
    "code": "MENU_CUSTOMS_SHIPMENTS",
    "moduleCode": "M2",
    "path": "/customs/shipments",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_CUSTOMS",
    "sourceLine": 289,
    "reservedAdmin": false
  },
  {
    "code": "MENU_CUSTOMS_SHIPMENTS_ID",
    "moduleCode": "M2",
    "path": "/customs/shipments/:id",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_CUSTOMS_SHIPMENTS",
    "sourceLine": 299,
    "reservedAdmin": false
  },
  {
    "code": "MENU_CUSTOMS_DECLARATIONS",
    "moduleCode": "M2",
    "path": "/customs/declarations",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_CUSTOMS",
    "sourceLine": 309,
    "reservedAdmin": false
  },
  {
    "code": "MENU_CUSTOMS_DECLARATIONS_NEW",
    "moduleCode": "M2",
    "path": "/customs/declarations/new",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_CUSTOMS_DECLARATIONS",
    "sourceLine": 319,
    "reservedAdmin": false
  },
  {
    "code": "MENU_CUSTOMS_SETTLEMENTS",
    "moduleCode": "M2",
    "path": "/customs/settlements",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_CUSTOMS",
    "sourceLine": 329,
    "reservedAdmin": false
  },
  {
    "code": "MENU_CUSTOMS_LANDED_COST",
    "moduleCode": "M2",
    "path": "/customs/landed-cost",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_CUSTOMS",
    "sourceLine": 339,
    "reservedAdmin": false
  },
  {
    "code": "MENU_CUSTOMS_SHIPMENTS_ID_LANDED_COST",
    "moduleCode": "M2",
    "path": "/customs/shipments/:id/landed-cost",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_CUSTOMS_SHIPMENTS_ID",
    "sourceLine": 349,
    "reservedAdmin": false
  },
  {
    "code": "MENU_CUSTOMS_ACCOUNTING",
    "moduleCode": "M2",
    "path": "/customs/accounting",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_CUSTOMS",
    "sourceLine": 359,
    "reservedAdmin": false
  },
  {
    "code": "MENU_CUSTOMS_INVENTORY_KARDEX",
    "moduleCode": "M2",
    "path": "/customs/inventory/kardex",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_CUSTOMS",
    "sourceLine": 369,
    "reservedAdmin": false
  },
  {
    "code": "MENU_CUSTOMS_LEGACY",
    "moduleCode": "M2",
    "path": "/customs/legacy",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_CUSTOMS",
    "sourceLine": 382,
    "reservedAdmin": false
  },
  {
    "code": "MENU_PURCHASES_DASHBOARD",
    "moduleCode": "M8",
    "path": "/purchases/dashboard",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_PURCHASES",
    "sourceLine": 394,
    "reservedAdmin": false
  },
  {
    "code": "MENU_PURCHASES_PAYABLES",
    "moduleCode": "M8",
    "path": "/purchases/payables",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_PURCHASES",
    "sourceLine": 402,
    "reservedAdmin": false
  },
  {
    "code": "MENU_PURCHASES",
    "moduleCode": "M8",
    "path": "/purchases",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 410,
    "reservedAdmin": false
  },
  {
    "code": "MENU_PURCHASES_ORDERS",
    "moduleCode": "M8",
    "path": "/purchases/orders",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR"
    ],
    "parentCode": "MENU_PURCHASES",
    "sourceLine": 420,
    "reservedAdmin": false
  },
  {
    "code": "MENU_INVENTORY_DASHBOARD",
    "moduleCode": "M6",
    "path": "/inventory/dashboard",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 431,
    "reservedAdmin": false
  },
  {
    "code": "MENU_INVENTORY_STOCKS",
    "moduleCode": "M6",
    "path": "/inventory/stocks",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR",
      "OPERADOR_FACTURACION"
    ],
    "parentCode": null,
    "sourceLine": 441,
    "reservedAdmin": false
  },
  {
    "code": "MENU_INVENTORY_MOVEMENTS",
    "moduleCode": "M6",
    "path": "/inventory/movements",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR",
      "OPERADOR_FACTURACION"
    ],
    "parentCode": null,
    "sourceLine": 453,
    "reservedAdmin": false
  },
  {
    "code": "MENU_INVENTORY_TRANSFERS",
    "moduleCode": "M6",
    "path": "/inventory/transfers",
    "roles": [
      "ADMIN"
    ],
    "parentCode": null,
    "sourceLine": 463,
    "reservedAdmin": false
  },
  {
    "code": "MENU_INVENTORY_ADJUSTMENTS",
    "moduleCode": "M6",
    "path": "/inventory/adjustments",
    "roles": [
      "ADMIN"
    ],
    "parentCode": null,
    "sourceLine": 471,
    "reservedAdmin": false
  },
  {
    "code": "MENU_INVENTORY_OPENING",
    "moduleCode": "M6",
    "path": "/inventory/opening",
    "roles": [
      "ADMIN"
    ],
    "parentCode": null,
    "sourceLine": 479,
    "reservedAdmin": false
  },
  {
    "code": "MENU_INVENTORY_CONFIG",
    "moduleCode": "M6",
    "path": "/inventory/config",
    "roles": [
      "ADMIN",
      "CONTADOR"
    ],
    "parentCode": null,
    "sourceLine": 487,
    "reservedAdmin": false
  },
  {
    "code": "MENU_KARDEX_GENERAL",
    "moduleCode": "M6",
    "path": "/kardex/general",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR",
      "OPERADOR_FACTURACION"
    ],
    "parentCode": null,
    "sourceLine": 504,
    "reservedAdmin": false
  },
  {
    "code": "MENU_KARDEX_PRODUCTO",
    "moduleCode": "M6",
    "path": "/kardex/producto",
    "roles": [
      "ADMIN",
      "OPERADOR_ADUANAS",
      "CONTADOR",
      "AUDITOR",
      "OPERADOR_FACTURACION"
    ],
    "parentCode": null,
    "sourceLine": 514,
    "reservedAdmin": false
  },
  {
    "code": "MENU_SIRE_CREDENCIALES",
    "moduleCode": "M3",
    "path": "/sire/credenciales",
    "roles": [
      "ADMIN"
    ],
    "parentCode": null,
    "sourceLine": 531,
    "reservedAdmin": false
  },
  {
    "code": "MENU_SIRE_CONFIGURACION",
    "moduleCode": "M3",
    "path": "/sire/configuracion",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 532,
    "reservedAdmin": false
  },
  {
    "code": "MENU_SIRE_IMPORTAR",
    "moduleCode": "M3",
    "path": "/sire/importar",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 541,
    "reservedAdmin": false
  },
  {
    "code": "MENU_SIRE_PERIODOS",
    "moduleCode": "M3",
    "path": "/sire/periodos",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 549,
    "reservedAdmin": false
  },
  {
    "code": "MENU_SIRE_CONCILIACION",
    "moduleCode": "M3",
    "path": "/sire/conciliacion",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 559,
    "reservedAdmin": false
  },
  {
    "code": "MENU_SIRE_CIERRE",
    "moduleCode": "M3",
    "path": "/sire/cierre",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 567,
    "reservedAdmin": false
  },
  {
    "code": "MENU_SIRE_HISTORIAL",
    "moduleCode": "M3",
    "path": "/sire/historial",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 575,
    "reservedAdmin": false
  },
  {
    "code": "MENU_ACCOUNTING_DASHBOARD",
    "moduleCode": "M4",
    "path": "/accounting/dashboard",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_ACCOUNTING",
    "sourceLine": 585,
    "reservedAdmin": false
  },
  {
    "code": "MENU_ACCOUNTING",
    "moduleCode": "M4",
    "path": "/accounting",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 593,
    "reservedAdmin": false
  },
  {
    "code": "MENU_ACCOUNTING_LEDGER",
    "moduleCode": "M4",
    "path": "/accounting/ledger",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_ACCOUNTING",
    "sourceLine": 601,
    "reservedAdmin": false
  },
  {
    "code": "MENU_ACCOUNTING_INCOME_STATEMENT",
    "moduleCode": "M4",
    "path": "/accounting/income-statement",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_ACCOUNTING",
    "sourceLine": 609,
    "reservedAdmin": false
  },
  {
    "code": "MENU_ACCOUNTING_TRIAL_BALANCE",
    "moduleCode": "M4",
    "path": "/accounting/trial-balance",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_ACCOUNTING",
    "sourceLine": 617,
    "reservedAdmin": false
  },
  {
    "code": "MENU_ACCOUNTING_BALANCE_SHEET",
    "moduleCode": "M4",
    "path": "/accounting/balance-sheet",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_ACCOUNTING",
    "sourceLine": 625,
    "reservedAdmin": false
  },
  {
    "code": "MENU_ACCOUNTING_AUDITORIA",
    "moduleCode": "M4",
    "path": "/accounting/auditoria",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_ACCOUNTING",
    "sourceLine": 633,
    "reservedAdmin": false
  },
  {
    "code": "MENU_SALES_COBRANZAS",
    "moduleCode": "M7",
    "path": "/sales/cobranzas",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_SALES",
    "sourceLine": 641,
    "reservedAdmin": false
  },
  {
    "code": "MENU_COLLECTIONS",
    "moduleCode": "M7",
    "path": "/collections",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 649,
    "reservedAdmin": false
  },
  {
    "code": "MENU_PURCHASES_EXPENSES",
    "moduleCode": "M8",
    "path": "/purchases/expenses",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_PURCHASES",
    "sourceLine": 657,
    "reservedAdmin": false
  },
  {
    "code": "MENU_EXPENSES",
    "moduleCode": "M4",
    "path": "/expenses",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": null,
    "sourceLine": 665,
    "reservedAdmin": false
  },
  {
    "code": "MENU_ACCOUNTING_RULES",
    "moduleCode": "M4",
    "path": "/accounting/rules",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_ACCOUNTING",
    "sourceLine": 673,
    "reservedAdmin": false
  },
  {
    "code": "MENU_ACCOUNTING_GUIA",
    "moduleCode": "M4",
    "path": "/accounting/guia",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_ACCOUNTING",
    "sourceLine": 681,
    "reservedAdmin": false
  },
  {
    "code": "MENU_ACCOUNTING_PLAN_CUENTAS",
    "moduleCode": "M4",
    "path": "/accounting/plan-cuentas",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_ACCOUNTING",
    "sourceLine": 681,
    "reservedAdmin": false
  },
  {
    "code": "MENU_ACCOUNTING_PERIODS",
    "moduleCode": "M4",
    "path": "/accounting/periods",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_ACCOUNTING",
    "sourceLine": 689,
    "reservedAdmin": false
  },
  {
    "code": "MENU_ACCOUNTING_TAX_BOOKS",
    "moduleCode": "M4",
    "path": "/accounting/tax-books",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_ACCOUNTING",
    "sourceLine": 697,
    "reservedAdmin": false
  },
  {
    "code": "MENU_ACCOUNTING_PLE",
    "moduleCode": "M4",
    "path": "/accounting/ple",
    "roles": [
      "ADMIN",
      "CONTADOR",
      "AUDITOR"
    ],
    "parentCode": "MENU_ACCOUNTING",
    "sourceLine": 705,
    "reservedAdmin": false
  }
];
