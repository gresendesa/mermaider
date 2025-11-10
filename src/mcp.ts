import process from "node:process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import type { Page } from "puppeteer-core";
import { z } from "zod";
import pkg from "../package.json" with { type: "json" };
import { verifyDiagramSyntax } from "./mermaider";

export default async function run(page: Page): Promise<void> {
  // Create MCP server
  const server = new McpServer({
    name: "mermaider",
    version: pkg.version,
  });

  server.tool(
    "validate_syntax",
    `Validates Mermaid diagram syntax.`,
    {
      diagram_code: z.string().describe("Mermaid diagram code"),
    },
    async ({ diagram_code }) => {
      const result = await page.evaluate(verifyDiagramSyntax, diagram_code);
      const isError = typeof result === "string";
      return {
        isError,
        content: [{ type: "text", text: isError ? result : "" }],
      };
    },
  );

  // --- Configuração HTTP/SSE ---
  const app = express();
  let transport: SSEServerTransport | null = null;

  app.get("/sse", async (req, res) => {
    console.error("Nova conexão SSE estabelecida.");
    transport = new SSEServerTransport("/messages", res);
    await server.connect(transport);
  });

  app.post("/messages", async (req, res) => {
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send("Nenhuma conexão SSE ativa.");
    }
  });

  const PORT = process.env.PORT || 3000;
  const httpServer = app.listen(PORT, () => {
    console.error(`Servidor MCP Mermaider rodando em http://0.0.0.0:${PORT}/sse`);
  });

  // Mantém o processo rodando até receber um sinal de término
  return new Promise<void>((resolve) => {
    process.on('SIGINT', () => { httpServer.close(); resolve(); });
    process.on('SIGTERM', () => { httpServer.close(); resolve(); });
  });
}