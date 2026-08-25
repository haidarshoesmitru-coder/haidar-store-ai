import { AttributeService, createAttributeSchema } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { validate } from '@/shared/validation/validate';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/**
 * Why this file exists: GET (list) / POST (create) for Attribute
 * definitions — new in Sprint 2.4, filling the gap flagged since Sprint
 * 2.1 (no Attribute management API existed). Needed for real reason: the
 * admin panel's dynamic-attribute picker has nothing to populate itself
 * from without this. GET requires `staff`, not public — attribute
 * definitions are an internal catalog-management concern, not
 * storefront-facing data. POST requires `manager`, matching every other
 * catalog-structure-defining endpoint (categories, brands).
 */

const attributeService = new AttributeService();

export const GET = createCatalogRoute(
  async () => {
    const attributes = await attributeService.listAttributes();
    return { data: attributes, message: 'Attributes retrieved.' };
  },
  { requiredRoleLevel: ROLE_LEVEL.staff },
);

export const POST = createCatalogRoute(
  async ({ req }) => {
    const body = validate(createAttributeSchema, await req.json());
    const attribute = await attributeService.createAttribute(body);
    return { data: attribute, message: 'Attribute created.', status: 201 };
  },
  { requiredRoleLevel: ROLE_LEVEL.manager },
);
