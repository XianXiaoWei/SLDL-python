export class SldlException extends Error {
  type: SimpleExceptionBuilder | DynamicExceptionBuilder;
  constructor(msg: string, type: SimpleExceptionBuilder | DynamicExceptionBuilder);
  as(): string;
}

export class SimpleExceptionBuilder {
  message: string;
  constructor(msg: string);
  from(): SldlException;
}

export class DynamicExceptionBuilder {
  builder: (...args: any[]) => string;
  constructor(builder: (...args: any[]) => string);
  from(...args: any[]): SldlException;
}
