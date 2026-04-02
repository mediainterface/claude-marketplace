#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AdoClient } from "./ado-client.js";
import { AdoApiError } from "./errors.js";
import { parseAdoRemote } from "./git-remote-parser.js";

// Read required env vars at startup
const ADO_PAT = process.env.ADO_PAT;
if (!ADO_PAT) {
  console.error("Error: ADO_PAT environment variable is required");
  process.exit(1);
}

const ADO_API_VERSION = process.env.ADO_API_VERSION ?? "7.1";

// Shared connection params schema (reused by ado_get/post/patch/delete)
const connectionSchema = {
  server: z.string().describe("ADO server URL, e.g. https://ado.example.com/tfs"),
  collection: z.string().describe("ADO collection name"),
  project: z.string().describe("ADO project name"),
};

const acceptSchema = {
  accept: z
    .string()
    .optional()
    .default("application/json")
    .describe("Accept header value (default: application/json)"),
};

// Helper: format a Response body as text
async function formatResponse(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (contentType.includes("application/json")) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }
  return text;
}

// Helper: build error result from caught error
function errorResult(err: unknown): { content: [{ type: "text"; text: string }]; isError: true } {
  if (err instanceof AdoApiError) {
    const message = `ADO API error ${err.status}\nEndpoint: ${err.endpoint}\nBody: ${err.body}`;
    return { content: [{ type: "text", text: message }], isError: true };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text: message }], isError: true };
}

// Create MCP server
const server = new McpServer({ name: "ado", version: "1.0.0" });

// AdoClient is instantiated per-call because server/collection/project
// arrive as tool arguments — the same MCP server may serve multiple projects.

// ado_get
server.registerTool(
  "ado_get",
  {
    description: "Perform a GET request against the Azure DevOps REST API",
    inputSchema: z.object({
      ...connectionSchema,
      path: z.string().describe("API path, e.g. /build/builds"),
      ...acceptSchema,
    }),
  },
  async ({ server: serverUrl, collection, project, path, accept }) => {
    try {
      const client = new AdoClient(serverUrl, collection, project, ADO_PAT, ADO_API_VERSION);
      const response = await client.get(path, accept);
      const text = await formatResponse(response);
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ado_post
server.registerTool(
  "ado_post",
  {
    description: "Perform a POST request against the Azure DevOps REST API",
    inputSchema: z.object({
      ...connectionSchema,
      path: z.string().describe("API path, e.g. /git/repositories/my-repo/pullrequests"),
      body: z.string().describe("JSON request body"),
      ...acceptSchema,
    }),
  },
  async ({ server: serverUrl, collection, project, path, body, accept }) => {
    try {
      const client = new AdoClient(serverUrl, collection, project, ADO_PAT, ADO_API_VERSION);
      const response = await client.post(path, body, accept);
      const text = await formatResponse(response);
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ado_patch
server.registerTool(
  "ado_patch",
  {
    description: "Perform a PATCH request against the Azure DevOps REST API",
    inputSchema: z.object({
      ...connectionSchema,
      path: z.string().describe("API path, e.g. /git/repositories/my-repo/pullrequests/42"),
      body: z.string().describe("JSON request body"),
      ...acceptSchema,
    }),
  },
  async ({ server: serverUrl, collection, project, path, body, accept }) => {
    try {
      const client = new AdoClient(serverUrl, collection, project, ADO_PAT, ADO_API_VERSION);
      const response = await client.patch(path, body, accept);
      const text = await formatResponse(response);
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ado_delete
server.registerTool(
  "ado_delete",
  {
    description: "Perform a DELETE request against the Azure DevOps REST API",
    inputSchema: z.object({
      ...connectionSchema,
      path: z.string().describe("API path"),
      ...acceptSchema,
    }),
  },
  async ({ server: serverUrl, collection, project, path, accept }) => {
    try {
      const client = new AdoClient(serverUrl, collection, project, ADO_PAT, ADO_API_VERSION);
      const response = await client.delete(path, accept);
      const text = await formatResponse(response);
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return errorResult(err);
    }
  }
);

// parse_ado_remote
server.registerTool(
  "parse_ado_remote",
  {
    description:
      "Parse an Azure DevOps git remote URL and extract server, collection, project, and repository",
    inputSchema: z.object({
      remote_url: z
        .string()
        .describe(
          "Git remote URL, e.g. https://ado.example.com/tfs/MyCollection/MyProject/_git/MyRepo"
        ),
    }),
  },
  async ({ remote_url }) => {
    const result = parseAdoRemote(remote_url);
    if (!result) {
      return {
        content: [{ type: "text", text: "Not an ADO URL: could not parse remote URL" }],
        isError: true,
      };
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Connect via stdio transport
try {
  const transport = new StdioServerTransport();
  await server.connect(transport);
} catch (err) {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
}
