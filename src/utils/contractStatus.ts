export const CONTRACT_STATUSES = [
  "draft",
  "in_review",
  "ready_to_sign",
  "starting",
  "signing",
  "executed",
  "declined",
  "void",
  "expired",
] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_STATUS_TRANSITIONS: Readonly<Record<ContractStatus, readonly ContractStatus[]>> = {
  draft: ["in_review", "ready_to_sign", "void"],
  in_review: ["draft", "ready_to_sign", "expired", "void"],
  ready_to_sign: ["draft", "starting", "in_review", "expired", "void"],
  starting: ["ready_to_sign", "signing", "expired", "void"],
  signing: ["executed", "declined", "expired", "void"],
  executed: ["void"],
  declined: ["draft", "in_review", "void"],
  void: [],
  expired: ["draft", "in_review", "ready_to_sign", "void"],
};

export function isContractStatus(value: string): value is ContractStatus {
  return (CONTRACT_STATUSES as readonly string[]).includes(value);
}

export function assertValidStatusTransition(current: string, next: ContractStatus): void {
  if (!isContractStatus(current) || !isContractStatus(next)) {
    throw new Error(`Unknown Contract status transition: ${current} -> ${next}.`);
  }
  if (current === next) return;
  const allowed = CONTRACT_STATUS_TRANSITIONS[current];
  if (!allowed?.includes(next)) {
    throw new Error(`Contract cannot move from ${current} to ${next}.`);
  }
}

export function buildContractStatusUpdate<
  TWhere extends object,
  TData extends object,
>(input: {
  where: TWhere;
  from: string;
  to: ContractStatus;
  data?: TData;
}): { where: TWhere & { status: string }; data: TData & { status: ContractStatus } } {
  assertValidStatusTransition(input.from, input.to);
  return {
    where: { ...input.where, status: input.from },
    data: { ...(input.data ?? {} as TData), status: input.to },
  };
}
