/**
 * Discord MCP — bootstrap transport stdio SEUL.
 *
 * ⚠️ CE FICHIER NE CONTIENT QUE LE TRANSPORT — toute la logique est dans dispatch.js
 * (pour rester testable sans démarrer MCP). Les outils sont AUTO-DÉCOUVERTS depuis
 * handlers/ (aucun mapping manuel). Ajouter un outil = déposer un fichier handlers/*.js
 * exportant `tool = {name, description, inputSchema, handle}`. C'est tout.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { handleTool, listTools } from "./dispatch.js";

const server = new Server(
  { name: "discord-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = await listTools();
  return {
    tools: tools.map((t) => ({
      ...t,
      inputSchema: {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        ...t.inputSchema,
        additionalProperties: false,
      },
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    const result = await handleTool(name, args || {});
    return { content: [{ type: "text", text: String(result) }] };
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  process.stderr.write(`Discord MCP fatal: ${e.message}\n`);
  process.exit(1);
});
