export enum ELoggerType {
  debug = "debug",
  info = "info",
  warn = "warn",
  error = "error",
}

export const factoryFormatLog =
  (options: { tag: string }) =>
  (...args: unknown[]) => {
    return `[${options.tag}] ${args.map((arg) => JSON.stringify(arg)).join(" ")}`;
  };

export const logger = {
  debug: (...args: unknown[]) => console.debug(...args),
  info: (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};

export const genTraceID = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};
