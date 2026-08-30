import fs from "fs";
import path from "path";
import { z } from "zod";
import { KnowledgeBase, KnowledgeBasePort } from "../../core/ports/KnowledgeBasePort";
import { OperationFailure } from "../../core/types/errors";

const KnowledgeCardSchema = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  tldr: z.string().optional(),
  rawText: z.string().optional()
}).passthrough();

const KnowledgeFileSchema = z.object({ cards: z.array(KnowledgeCardSchema).default([]) });

export class JsonKnowledgeBaseAdapter implements KnowledgeBasePort {
  constructor(private readonly dataDirectory: string) {}

  async getKnowledgeBases(): Promise<KnowledgeBase[]> {
    const sources = ["katia_haranaka", "guilherme_freccia", "nutricao"];
    return sources.flatMap((name) => {
      const filePath = path.join(this.dataDirectory, `${name}_kb.json`);
      if (!fs.existsSync(filePath)) return [];
      try {
        const parsed = KnowledgeFileSchema.parse(JSON.parse(fs.readFileSync(filePath, "utf8")));
        return [{ name, cards: parsed.cards }];
      } catch (error) {
        throw new OperationFailure({
          code: "KNOWLEDGE_BASE_INVALID",
          category: "internal",
          message: `A base de conhecimento ${name} não pôde ser carregada.`,
          retryable: false
        }, { cause: error });
      }
    });
  }
}
