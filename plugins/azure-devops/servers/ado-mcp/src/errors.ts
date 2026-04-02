export class AdoApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    public readonly body: string
  ) {
    super(`ADO API error ${status} on ${endpoint}: ${body}`);
    this.name = "AdoApiError";
  }
}
