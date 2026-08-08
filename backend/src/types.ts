export interface KnowledgeSource {
  id: string;
  name: string;
  type: 'file' | 'url' | 'text';
  content: string;
  size: number;
  wordCount: number;
  createdAt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  citations?: Array<{
    sourceId: string;
    sourceName: string;
    textExcerpt: string;
  }>;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

export interface ChatResponse {
  answer: string;
  citations: Array<{
    sourceId: string;
    sourceName: string;
    textExcerpt: string;
  }>;
}
