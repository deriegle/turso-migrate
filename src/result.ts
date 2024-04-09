type Ok<T> = { success: true; value: T };
type Failure = { success: false; error: string };

export type Result<T = undefined> = Ok<T> | Failure;

const ok = <T>(value: T): Ok<T> => ({
  success: true,
  value,
});

const failure = (error: Failure["error"]): Failure => ({
  success: false,
  error,
});

export const Result = {
  ok,
  failure,
};
