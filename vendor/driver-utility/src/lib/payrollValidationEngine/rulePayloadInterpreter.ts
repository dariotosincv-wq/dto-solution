import type {
  RuleParameterValue,
  RulePayload,
} from './ruleEngine/types';
import { assertRulePayload } from './ruleEngine/rulePayload';

export interface InterpretedRuleParameter {
  readonly key: string;
  readonly value: RuleParameterValue;
}

export interface InterpretedParameterSet {
  readonly kind: 'PARAMETER_SET';
  readonly parameters: ReadonlyArray<InterpretedRuleParameter>;
}

export type RulePayloadInterpretationErrorCode =
  | 'PAYLOAD_MISSING'
  | 'INVALID_PAYLOAD'
  | 'UNSUPPORTED_PAYLOAD_KIND';

export class RulePayloadInterpretationError extends TypeError {
  readonly code: RulePayloadInterpretationErrorCode;
  readonly payloadKind: RulePayload['kind'] | undefined;

  constructor(
    code: RulePayloadInterpretationErrorCode,
    payloadKind?: RulePayload['kind']
  ) {
    super(
      code === 'PAYLOAD_MISSING'
        ? 'Rule payload is required'
        : code === 'INVALID_PAYLOAD'
          ? 'Rule payload is structurally invalid'
          : `Unsupported rule payload kind: ${payloadKind}`
    );
    this.name = 'RulePayloadInterpretationError';
    this.code = code;
    this.payloadKind = payloadKind;
  }
}

/**
 * Interpreta esclusivamente payload PARAMETER_SET gia validati dal Rule Engine.
 * Non valuta formule e non modifica il payload ricevuto.
 */
export const interpretRulePayload = (
  payload: RulePayload | null | undefined
): InterpretedParameterSet => {
  if (payload === null || payload === undefined) {
    throw new RulePayloadInterpretationError('PAYLOAD_MISSING');
  }
  try {
    assertRulePayload(payload);
  } catch {
    throw new RulePayloadInterpretationError('INVALID_PAYLOAD', payload.kind);
  }
  if (payload.kind !== 'PARAMETER_SET') {
    throw new RulePayloadInterpretationError(
      'UNSUPPORTED_PAYLOAD_KIND',
      payload.kind
    );
  }

  return Object.freeze({
    kind: 'PARAMETER_SET',
    parameters: Object.freeze(
      payload.parameters.map((parameter) =>
        Object.freeze({ key: parameter.key, value: parameter.value })
      )
    ),
  });
};
