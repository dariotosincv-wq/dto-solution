import type {
  ParameterSetRulePayload,
  RangeRulePayload,
  RuleParameter,
  RuleParameterValue,
  RulePayload,
  ThresholdRulePayload,
} from './types';

const isPlainObject = (value: unknown): value is object => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const hasOnlyKeys = (
  value: object,
  required: ReadonlyArray<string>,
  optional: ReadonlyArray<string> = []
): boolean => {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string')) return false;
  if (
    keys.some((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor === undefined || !('value' in descriptor);
    })
  ) {
    return false;
  }
  if (
    required.some(
      (key) => !Object.prototype.hasOwnProperty.call(value, key)
    )
  ) return false;
  const supported = new Set([...required, ...optional]);
  return keys.every((key) => typeof key === 'string' && supported.has(key));
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isParameterValue = (value: unknown): value is RuleParameterValue =>
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  isFiniteNumber(value);

const isParameter = (value: unknown): value is RuleParameter => {
  if (!isPlainObject(value) || !hasOnlyKeys(value, ['key', 'value'])) return false;
  const key = Reflect.get(value, 'key');
  return (
    typeof key === 'string' &&
    key.length > 0 &&
    isParameterValue(Reflect.get(value, 'value'))
  );
};

const isParameterSet = (value: object): value is ParameterSetRulePayload => {
  if (!hasOnlyKeys(value, ['kind', 'parameters'])) return false;
  const parameters = Reflect.get(value, 'parameters');
  if (
    !Array.isArray(parameters) ||
    parameters.length !== Object.keys(parameters).length ||
    !parameters.every(isParameter)
  ) {
    return false;
  }
  const keys = parameters.map((parameter) => parameter.key);
  return new Set(keys).size === keys.length;
};

const isThreshold = (value: object): value is ThresholdRulePayload => {
  if (!hasOnlyKeys(value, ['kind', 'comparison', 'value'])) return false;
  const comparison = Reflect.get(value, 'comparison');
  return (
    (comparison === 'MINIMUM' || comparison === 'MAXIMUM') &&
    isFiniteNumber(Reflect.get(value, 'value'))
  );
};

const isRange = (value: object): value is RangeRulePayload => {
  if (
    !hasOnlyKeys(
      value,
      ['kind', 'includeMinimum', 'includeMaximum'],
      ['minimum', 'maximum']
    )
  ) {
    return false;
  }

  const minimum = Reflect.get(value, 'minimum');
  const maximum = Reflect.get(value, 'maximum');
  if (minimum === undefined && maximum === undefined) return false;
  if (minimum !== undefined && !isFiniteNumber(minimum)) return false;
  if (maximum !== undefined && !isFiniteNumber(maximum)) return false;
  if (
    typeof minimum === 'number' &&
    typeof maximum === 'number' &&
    minimum > maximum
  ) {
    return false;
  }

  return (
    typeof Reflect.get(value, 'includeMinimum') === 'boolean' &&
    typeof Reflect.get(value, 'includeMaximum') === 'boolean'
  );
};

const isSupportedPayload = (value: unknown): value is RulePayload => {
  if (!isPlainObject(value)) return false;
  const kind = Reflect.get(value, 'kind');
  switch (kind) {
    case 'PARAMETER_SET':
      return isParameterSet(value);
    case 'THRESHOLD':
      return isThreshold(value);
    case 'RANGE':
      return isRange(value);
    default:
      return false;
  }
};

const isJsonSerializable = (value: unknown): boolean => {
  try {
    return JSON.stringify(value) !== undefined;
  } catch {
    return false;
  }
};

export function assertRulePayload(
  payload: unknown
): asserts payload is RulePayload {
  if (!isSupportedPayload(payload) || !isJsonSerializable(payload)) {
    throw new TypeError('Invalid or unsupported rule payload');
  }
}

const freezeParameterSet = (
  payload: Readonly<ParameterSetRulePayload>
): ParameterSetRulePayload =>
  Object.freeze({
    kind: payload.kind,
    parameters: Object.freeze(
      payload.parameters.map((parameter) => Object.freeze({ ...parameter }))
    ),
  });

const freezeThreshold = (
  payload: Readonly<ThresholdRulePayload>
): ThresholdRulePayload => Object.freeze({ ...payload });

const freezeRange = (
  payload: Readonly<RangeRulePayload>
): RangeRulePayload => Object.freeze({ ...payload });

export const freezeRulePayload = (payload: RulePayload): RulePayload => {
  switch (payload.kind) {
    case 'PARAMETER_SET':
      return freezeParameterSet(payload);
    case 'THRESHOLD':
      return freezeThreshold(payload);
    case 'RANGE':
      return freezeRange(payload);
  }
};
