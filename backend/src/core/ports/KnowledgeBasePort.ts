export interface KnowledgeCard {
  type?: string;
  name?: string;
  title?: string;
  category?: string;
  tags: string[];
  tldr?: string;
  rawText?: string;
}

export interface KnowledgeBase {
  name: string;
  cards: KnowledgeCard[];
}

export interface KnowledgeBasePort {
  getKnowledgeBases(): Promise<KnowledgeBase[]>;
}
