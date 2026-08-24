import {
  DISABLED_COMPANY_CONFIG,
  parseCompanyConfig,
  type CompanyConfigParseResult,
  type MissionControlCompanyConfig,
} from "./company-config.js";

export type CompanyId = string;

export type CompanyScope = Readonly<{
  config: MissionControlCompanyConfig;
  generation: number;
  valid: boolean;
}>;

export type CompanyPolicyState = ReadonlyMap<CompanyId, CompanyScope>;

export type SweepToken = Readonly<{
  companyId: CompanyId;
  generation: number;
}>;

export type CompanyConfigChangeResult = Readonly<{
  ok: true;
  state: CompanyPolicyState;
  companyId: CompanyId;
  generation: number;
  result: CompanyConfigParseResult;
}>;

export type CompanyConfigChangeRejection = Readonly<{
  ok: false;
  state: CompanyPolicyState;
  code: "invalid_company_id";
}>;

function isCompanyId(value: unknown): value is CompanyId {
  return typeof value === "string" && value.trim().length > 0;
}

function compareCompanyIds(left: CompanyId, right: CompanyId): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function createPolicyState(): CompanyPolicyState {
  return new Map();
}

export function applyCompanyConfigChange(
  state: CompanyPolicyState,
  companyId: unknown,
  value: unknown,
): CompanyConfigChangeResult | CompanyConfigChangeRejection {
  if (!isCompanyId(companyId)) {
    return Object.freeze({ ok: false, state, code: "invalid_company_id" });
  }

  const current = state.get(companyId);
  const generation = (current?.generation ?? 0) + 1;
  const result = parseCompanyConfig(value);
  const next = new Map(state);

  next.set(
    companyId,
    Object.freeze({
      config: result.ok ? result.config : DISABLED_COMPANY_CONFIG,
      generation,
      valid: result.ok,
    }),
  );

  return Object.freeze({ ok: true, state: next, companyId, generation, result });
}

export function selectSweepTokens(
  state: CompanyPolicyState,
): ReadonlyArray<SweepToken> {
  const tokens: SweepToken[] = [];

  for (const [companyId, scope] of state) {
    if (
      isCompanyId(companyId) &&
      scope.valid === true &&
      scope.config.enabled === true
    ) {
      tokens.push(
        Object.freeze({
          companyId,
          generation: scope.generation,
        }),
      );
    }
  }

  tokens.sort((left, right) => compareCompanyIds(left.companyId, right.companyId));
  return Object.freeze(tokens);
}

export function isSweepTokenCurrent(
  state: CompanyPolicyState,
  token: unknown,
): token is SweepToken {
  try {
    if (
      typeof token !== "object" ||
      token === null ||
      !Object.prototype.hasOwnProperty.call(token, "companyId") ||
      !Object.prototype.hasOwnProperty.call(token, "generation")
    ) {
      return false;
    }

    const candidate = token as { companyId?: unknown; generation?: unknown };
    if (
      !isCompanyId(candidate.companyId) ||
      typeof candidate.generation !== "number" ||
      !Number.isSafeInteger(candidate.generation)
    ) {
      return false;
    }

    const scope = state.get(candidate.companyId);
    return (
      scope?.valid === true &&
      scope.config.enabled === true &&
      scope.generation === candidate.generation
    );
  } catch {
    return false;
  }
}
