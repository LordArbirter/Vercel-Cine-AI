
import { GoogleGenAI, Type } from "@google/genai";
import { ResearchResult, AIAction } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const researchMovieInfo = async (query: string): Promise<ResearchResult> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Bạn là một chuyên gia nghiên cứu lore (truyền thuyết/thông tin nền) cho các tác giả fanfic. 
    Hãy tìm kiếm và tóm tắt thông tin cực kỳ chi tiết về: ${query}.
    
    Yêu cầu tóm tắt:
    1. Thông tin cơ bản (Tên, nguồn gốc, vai trò).
    2. Ngoại hình & Đặc điểm nhận dạng.
    3. Tính cách, tâm lý và các mâu thuẫn nội tâm.
    4. Các mối quan hệ quan trọng (Bạn bè, kẻ thù, người yêu).
    5. Các sự kiện lore quan trọng hoặc bối cảnh thế giới liên quan.
    6. Các chi tiết nhỏ (trivia) thú vị mà fanfic thường khai thác.
    
    Hãy trình bày một cách hệ thống, dễ đọc và giàu thông tin nhất có thể.`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text || "Không tìm thấy thông tin.";
  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

  return { text, sources };
};

export const fetchNotebookLMData = async (url: string): Promise<string> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Hãy phân tích và trích xuất các thông tin quan trọng từ tài liệu NotebookLM sau đây để phục vụ cho việc viết truyện: ${url}.
    
    Hãy tập trung vào:
    1. Cốt truyện chính và các tình tiết quan trọng.
    2. Danh sách nhân vật, ngoại hình, tính cách và vai trò.
    3. Bối cảnh thế giới, địa điểm và quy luật (nếu có).
    4. Các chủ đề chính, thông điệp hoặc phong cách hành văn.
    5. Bất kỳ lore hoặc chi tiết đặc biệt nào có thể làm giàu cho câu chuyện.
    
    Hãy trình bày dưới dạng tóm tắt súc tích, dễ hiểu để tác giả có thể sử dụng ngay.`,
    config: {
      tools: [{ urlContext: {} }],
    },
  });

  return response.text || "Không thể trích xuất dữ liệu từ liên kết này.";
};

export const generateStorySkeleton = async (prompt: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Dựa trên ý tưởng sau, hãy tạo cấu trúc truyện hoàn chỉnh: "${prompt}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          context: { type: Type.STRING },
          mainCharacters: { type: Type.STRING },
          supportingCharacters: { type: Type.STRING },
          powerSystem: { type: Type.STRING },
          initialContent: { type: Type.STRING }
        },
        required: ["title", "context", "mainCharacters", "supportingCharacters", "powerSystem", "initialContent"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    throw new Error("Không thể phân tích phản hồi từ AI");
  }
};

export const processStoryAI = async (
  actions: AIAction[],
  storyName: string,
  context: string,
  mainCharacters: string,
  supportingCharacters: string,
  powerSystem: string,
  currentContent: string,
  instruction: string = "",
  images: string[] = [],
): Promise<string> => {
  const ai = getAIClient();
  
  const instructionMap: Record<string, string> = {
    continue: "Viết tiếp câu chuyện một cách tự nhiên.",
    expand: "Miêu tả cực kỳ chi tiết về bối cảnh, cảm xúc và hành động của nhân vật.",
    rewrite: "Trau chuốt văn phong mượt mà, giàu hình ảnh và chuyên nghiệp hơn.",
    suggest_plot: "Gợi ý các hướng đi mới đầy kịch tính cho cốt truyện.",
  };

  // Kết hợp các chỉ thị dựa trên danh sách actions được chọn
  let combinedSystemInstruction = "Bạn là một nhà văn fanfic bậc thầy. ";
  if (actions.length > 0) {
    combinedSystemInstruction += "Hãy thực hiện các yêu cầu sau: " + actions.map(a => instructionMap[a]).join(" Đồng thời, ");
  } else {
    combinedSystemInstruction += instructionMap.continue;
  }
  combinedSystemInstruction += " Luôn giữ đúng tính cách nhân vật và bối cảnh đã nêu.";

  const textPrompt = `
    Tên truyện: ${storyName}
    Bối cảnh: ${context}
    Nhân vật chính: ${mainCharacters}
    Nhân vật phụ: ${supportingCharacters}
    Hệ thống sức mạnh: ${powerSystem}
    Nội dung hiện tại: ${currentContent}
    Yêu cầu bổ sung của người dùng: ${instruction}
  `;

  const parts: any[] = [{ text: textPrompt }];

  images.forEach((imgBase64) => {
    const [mimePart, dataPart] = imgBase64.split(';base64,');
    const mimeType = mimePart.split(':')[1];
    parts.push({
      inlineData: { mimeType: mimeType, data: dataPart },
    });
  });

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: { parts },
    config: {
      systemInstruction: combinedSystemInstruction,
      temperature: 0.9,
      topP: 0.95,
    },
  });

  return response.text || "";
};

export const processStoryAIStream = async (
  actions: AIAction[],
  storyName: string,
  context: string,
  mainCharacters: string,
  supportingCharacters: string,
  powerSystem: string,
  currentContent: string,
  onChunk: (chunk: string) => void,
  instruction: string = "",
  images: string[] = [],
): Promise<void> => {
  const ai = getAIClient();
  
  const instructionMap: Record<string, string> = {
    continue: "Viết tiếp câu chuyện một cách tự nhiên.",
    expand: "Miêu tả cực kỳ chi tiết về bối cảnh, cảm xúc và hành động của nhân vật.",
    rewrite: "Trau chuốt văn phong mượt mà, giàu hình ảnh và chuyên nghiệp hơn.",
    suggest_plot: "Gợi ý các hướng đi mới đầy kịch tính cho cốt truyện.",
  };

  let combinedSystemInstruction = "Bạn là một nhà văn fanfic bậc thầy. ";
  if (actions.length > 0) {
    combinedSystemInstruction += "Hãy thực hiện các yêu cầu sau: " + actions.map(a => instructionMap[a]).join(" Đồng thời, ");
  } else {
    combinedSystemInstruction += instructionMap.continue;
  }
  combinedSystemInstruction += " Luôn giữ đúng tính cách nhân vật và bối cảnh đã nêu.";

  const textPrompt = `
    Tên truyện: ${storyName}
    Bối cảnh: ${context}
    Nhân vật chính: ${mainCharacters}
    Nhân vật phụ: ${supportingCharacters}
    Hệ thống sức mạnh: ${powerSystem}
    Nội dung hiện tại: ${currentContent}
    Yêu cầu bổ sung của người dùng: ${instruction}
  `;

  const parts: any[] = [{ text: textPrompt }];

  images.forEach((imgBase64) => {
    const [mimePart, dataPart] = imgBase64.split(';base64,');
    const mimeType = mimePart.split(':')[1];
    parts.push({
      inlineData: { mimeType: mimeType, data: dataPart },
    });
  });

  const response = await ai.models.generateContentStream({
    model: "gemini-3-pro-preview",
    contents: { parts },
    config: {
      systemInstruction: combinedSystemInstruction,
      temperature: 0.9,
      topP: 0.95,
    },
  });

  for await (const chunk of response) {
    const text = chunk.text;
    if (text) {
      onChunk(text);
    }
  }
};

export const expandSelectionAIStream = async (
  selectedText: string,
  storyName: string,
  context: string,
  mainCharacters: string,
  supportingCharacters: string,
  powerSystem: string,
  onChunk: (chunk: string) => void
): Promise<void> => {
  const ai = getAIClient();
  const systemInstruction = "Bạn là một nhà văn fanfic bậc thầy. Nhiệm vụ của bạn là mở rộng đoạn văn bản được chọn, thêm chi tiết về bối cảnh, cảm xúc và hành động để làm cho nó phong phú và hấp dẫn hơn, trong khi vẫn giữ đúng văn phong và tính cách nhân vật của toàn bộ câu chuyện. Chỉ trả về đoạn văn bản đã được mở rộng, không kèm theo lời giải thích.";

  const textPrompt = `
    Tên truyện: ${storyName}
    Bối cảnh tổng thể: ${context}
    Nhân vật chính: ${mainCharacters}
    Nhân vật phụ: ${supportingCharacters}
    Hệ thống sức mạnh: ${powerSystem}
    
    Đoạn văn bản cần mở rộng: "${selectedText}"
    
    Yêu cầu: Hãy viết lại đoạn văn này một cách chi tiết hơn, miêu tả sâu sắc hơn về cảm xúc, hành động và môi trường xung quanh.
  `;

  const response = await ai.models.generateContentStream({
    model: "gemini-3-pro-preview",
    contents: [{ text: textPrompt }],
    config: {
      systemInstruction,
      temperature: 0.9,
    },
  });

  for await (const chunk of response) {
    const text = chunk.text;
    if (text) {
      onChunk(text);
    }
  }
};

export const expandSelectionAI = async (
  selectedText: string,
  storyName: string,
  context: string,
  mainCharacters: string,
): Promise<string> => {
  const ai = getAIClient();
  const systemInstruction = "Bạn là một nhà văn fanfic bậc thầy. Nhiệm vụ của bạn là mở rộng đoạn văn bản được chọn, thêm chi tiết về bối cảnh, cảm xúc và hành động để làm cho nó phong phú và hấp dẫn hơn, trong khi vẫn giữ đúng văn phong và tính cách nhân vật của toàn bộ câu chuyện. Chỉ trả về đoạn văn bản đã được mở rộng, không kèm theo lời giải thích.";

  const textPrompt = `
    Tên truyện: ${storyName}
    Bối cảnh tổng thể: ${context}
    Nhân vật chính: ${mainCharacters}
    
    Đoạn văn bản cần mở rộng: "${selectedText}"
    
    Yêu cầu: Hãy viết lại đoạn văn này một cách chi tiết hơn, miêu tả sâu sắc hơn về cảm xúc, hành động và môi trường xung quanh.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [{ text: textPrompt }],
    config: {
      systemInstruction,
      temperature: 0.9,
    },
  });

  return response.text || "";
};
