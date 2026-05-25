import type { UploadedDataset, WebSearchResult } from "@/types/scm";

export interface McpConnector<TInput, TOutput> {
  id: string;
  name: string;
  type: "web-search" | "file" | "erp" | "pos" | "inventory" | "supplier";
  status: "active" | "placeholder";
  run(input: TInput): Promise<TOutput>;
}

export const mcpConnectorConfig = {
  version: "0.1.0",
  readyForServers: true,
  connectors: [
    "webSearchConnector",
    "csvConnector",
    "excelConnector",
    "jsonConnector",
    "posConnector",
    "erpConnector",
    "inventoryConnector",
    "supplierConnector"
  ]
};

export const placeholderConnector = <TInput, TOutput>(id: string, name: string, type: McpConnector<TInput, TOutput>["type"]): McpConnector<TInput, TOutput> => ({
  id,
  name,
  type,
  status: "placeholder",
  async run() {
    throw new Error(`${name} is MCP-ready but not connected yet.`);
  }
});

export type WebSearchConnector = McpConnector<{ query: string }, WebSearchResult>;
export type FileConnector = McpConnector<File, UploadedDataset>;

export const posConnector = placeholderConnector("posConnector", "POS Connector", "pos");
export const erpConnector = placeholderConnector("erpConnector", "ERP Connector", "erp");
export const inventoryConnector = placeholderConnector("inventoryConnector", "Inventory Connector", "inventory");
export const supplierConnector = placeholderConnector("supplierConnector", "Supplier Connector", "supplier");
