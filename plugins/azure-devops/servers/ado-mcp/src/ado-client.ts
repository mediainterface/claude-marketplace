import { AdoApiError } from "./errors.js";

export class AdoClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly apiVersion: string;

  constructor(
    serverUrl: string,
    collection: string,
    project: string,
    pat: string,
    apiVersion: string = "7.1"
  ) {
    const projectEncoded = encodeURIComponent(project);
    this.baseUrl = `${serverUrl}/${collection}/${projectEncoded}/_apis`;
    this.authHeader = `Basic ${Buffer.from(`:${pat}`).toString("base64")}`;
    this.apiVersion = apiVersion;
  }

  private buildUrl(path: string): string {
    const fullUrl = `${this.baseUrl}${path}`;
    const separator = fullUrl.includes("?") ? "&" : "?";
    return `${fullUrl}${separator}api-version=${this.apiVersion}`;
  }

  async get(path: string, accept: string = "application/json"): Promise<Response> {
    const url = this.buildUrl(path);
    const response = await fetch(url, {
      headers: {
        Authorization: this.authHeader,
        Accept: accept,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new AdoApiError(response.status, `GET ${path}`, body);
    }
    return response;
  }

  async post(path: string, body: string, accept: string = "application/json"): Promise<Response> {
    const url = this.buildUrl(path);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: accept,
      },
      body,
    });
    if (!response.ok) {
      const responseBody = await response.text();
      throw new AdoApiError(response.status, `POST ${path}`, responseBody);
    }
    return response;
  }

  async patch(path: string, body: string, accept: string = "application/json"): Promise<Response> {
    const url = this.buildUrl(path);
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: accept,
      },
      body,
    });
    if (!response.ok) {
      const responseBody = await response.text();
      throw new AdoApiError(response.status, `PATCH ${path}`, responseBody);
    }
    return response;
  }

  async delete(path: string, accept: string = "application/json"): Promise<Response> {
    const url = this.buildUrl(path);
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: this.authHeader,
        Accept: accept,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new AdoApiError(response.status, `DELETE ${path}`, body);
    }
    return response;
  }
}
