
export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface ResearchResult {
  text: string;
  sources: GroundingChunk[];
}

export interface StoryVersion {
  id: string;
  content: string;
  timestamp: number;
}

export interface VideoData {
  data: string; // base64
  mimeType: string;
  name: string;
}

export interface StoryTemplate {
  id: string;
  name: string;
  description: string;
  defaultContent: string;
  icon: string;
}

export interface CharacterImage {
  url: string;
  name?: string;
}

export interface SavedPrompt {
  id: string;
  text: string;
  timestamp: number;
}

export interface Story {
  id: string;
  title: string;
  context?: string;
  mainCharacters?: string;
  supportingCharacters?: string;
  powerSystem?: string;
  characterImages?: CharacterImage[];
  content: string;
  updatedAt: number;
  deletedAt?: number | null;
  versions?: StoryVersion[];
}

export type AIAction = 'continue' | 'expand' | 'rewrite' | 'suggest_plot' | 'generate_skeleton';
