// Reuse the PostgreSQL-backed HTTP contract suite in the dedicated E2E runner.
// It authenticates real JWTs through the existing guards and never emits documents.
import '../../setup';
import '../../integration/invoices/issuer-config.integration.spec';
