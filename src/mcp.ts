import process from "node:process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import type { Page } from "puppeteer-core";
import { z } from "zod";
import pkg from "../package.json" with { type: "json" };
import { verifyDiagramSyntax } from "./mermaider";

// --- Armazenamento de Transportes Ativos ---
// Precisamos de um Map para rastrear um transporte para cada conexão ativa.
const activeTransports = new Map<string, SSEServerTransport>();

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

  app.get("/sse", async (req, res) => {
    console.error("Nova conexão SSE estabelecida.");
    
    // 1. Cria um NOVO transporte para ESTA conexão
    const transport = new SSEServerTransport("/messages", res);

    // 2. Obtém o sessionId do transporte.
    // NOTA: A SDK (v1.12.0) parece não expor isso publicamente de forma óbvia.
    // No entanto, o transporte envia o endpoint com o sessionId.
    // Vamos extraí-lo da URL do endpoint que o transporte gera.
    // (Esta é uma suposição baseada no comportamento; o nome da propriedade pode ser outro)
    const sessionId = transport.sessionId;

    if (!sessionId) {
      console.error("Falha ao obter sessionId do novo transporte.");
      res.status(500).send("Falha ao iniciar sessão SSE.");
      return;
    }

    // 3. Armazena a instância de transporte usando o sessionId como chave
    activeTransports.set(sessionId, transport);
    console.error(`Sessão ${sessionId} registrada.`);

    // 4. Limpa o transporte quando a conexão fechar
    res.on('close', () => {
      console.error(`Conexão SSE fechada: ${sessionId}`);
      activeTransports.delete(sessionId);
    });

    // 5. Conecta este transporte específico ao servidor
    await server.connect(transport);
  });

  app.post("/messages", async (req, res) => {
    // 1. Obtém o sessionId da query string da URL
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      console.error("Recebido POST sem sessionId.");
      return res.status(400).send("Missing sessionId query parameter.");
    }

    // 2. Encontra a instância de transporte CORRETA no Map
    const transport = activeTransports.get(sessionId);

    if (transport) {
      // 3. Chama o handlePostMessage na instância correta
      await transport.handlePostMessage(req, res);
    } else {
      console.error(`Recebido POST para sessão desconhecida: ${sessionId}`);
      res.status(404).send(`Nenhuma conexão SSE ativa para a sessão: ${sessionId}`);
    }
  });

  const PORT = process.env.PORT || 3000;
  const httpServer = app.listen(PORT, () => {
    console.error(`Servidor MCP Mermaider rodando em http://0.0.0.0:${PORT}/sse`);
  });

  // Mantém o processo rodando até receber um sinal de término
  return new Promise<void>((resolve) => {
    process.on('SIGINT', () => { console.error('SIGINT recebido, desligando...'); httpServer.close(); resolve(); });
    process.on('SIGTERM', () => { console.error('SIGTERM recebido, desligando...'); httpServer.close(); resolve(); });
  });
}