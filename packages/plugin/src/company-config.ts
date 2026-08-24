export type MissionControlCompanyConfig = Readonly<{
  enabled: boolean;
}>;

export type CompanyConfigErrorCode =
  | "not_plain_object"
  | "unknown_keys"
  | "enabled_not_boolean";

export type CompanyConfigParseResult =
  | Readonly<{
      ok: true;
      config: MissionControlCompanyConfig;
    }>
  | Readonly<{
      ok: false;
      code: CompanyConfigErrorCode;
    }>;

export const DISABLED_COMPANY_CONFIG: MissionControlCompanyConfig = Object.freeze({
  enabled: false,
});

function failure(code: CompanyConfigErrorCode): CompanyConfigParseResult {
  return Object.freeze({ ok: false, code });
}

function isPlainObject(value: unknown): value is Record<PropertyKey, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

export function parseCompanyConfig(value: unknown): CompanyConfigParseResult {
  if (value === undefined) {
    return Object.freeze({ ok: true, config: DISABLED_COMPANY_CONFIG });
  }

  if (!isPlainObject(value)) {
    return failure("not_plain_object");
  }

  let keys: readonly (string | symbol)[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    return failure("not_plain_object");
  }

  if (keys.some((key) => key !== "enabled")) {
    return failure("unknown_keys");
  }

  let enabled: unknown;
  try {
    if (!Object.prototype.hasOwnProperty.call(value, "enabled")) {
      return failure("enabled_not_boolean");
    }
    enabled = value.enabled;
  } catch {
    return failure("enabled_not_boolean");
  }

  if (typeof enabled !== "boolean") {
    return failure("enabled_not_boolean");
  }

  return Object.freeze({
    ok: true,
    config: Object.freeze({ enabled }),
  });
}
