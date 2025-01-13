import { type Tool, SchemaType } from "@google/generative-ai";

// Tool configurations
export const translationTools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "render_subtitles",
        description: "Displays subtitles in an overlay window. Use this whenever you wish to display subtitles.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            subtitles: {
              type: SchemaType.STRING,
              description: "The text to display as subtitles",
            },
          },
          required: ["subtitles"],
        },
      },
      {
        name: "remove_subtitles",
        description: "Removes the subtitles overlay window. Use this when the user is done translating text.",
      },
    ],
  },
];

export const graphingTools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "render_graph",
        description: "Displays a graph using Vega-Lite/Altair JSON specification.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            json_graph: {
              type: SchemaType.STRING,
              description: "JSON STRING representation of the graph to render. Must be a string, not a json object",
            },
          },
          required: ["json_graph"],
        },
      },
    ],
  },
];

export const readWriteTools: Tool[] = [
  {
    functionDeclarations: [
      
      {
        name: "read_text",
        description: "Reads text from the user's screen",
      },
      {
        name: "write_text",
        description: "Writes the provided text at the current cursor position in any active window.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            content: {
              type: SchemaType.STRING,
              description: "The text content to write at the current cursor position",
            },
          },
          required: ["content"],
        },
      },
    ],
  },
]

// Mode-based configurations
export const assistantConfigs = {
  daily_helper: {
    display_name: "Daily Helper",
    tools: [...translationTools, ...graphingTools, ...readWriteTools],
    systemInstruction: `You are Screen Sense AI - a helpful assistant. You are running in the daily assistant mode, with the following capabilities:
1. Translation: When asked to translate text, render the translated subtitles on the user's screen, and remove the subtitles from the screen when done.
2. Graphing: When asked to create a graph or visualization, you must render a graph with a Vega-Lite specification. Make your best judgment about the visualization type.
3. Reading and Writing: You can read text from the user's screen, and write text to the user's screen.

If asked to introduce yourself or your capabilites, mention that you are Screen Sense AI, you are running in the daily assistant mode, and what capabilities you have.`
  },
  translator: {
    display_name: "Transcriber", 
    tools: translationTools,
    systemInstruction: `You are Screen Sense AI - a helpful assistant. You are running in translator mode. Your task is to convert everything you hear into English, and display it as subtitles.
When the user asks you to stop translating, hide the subtitles.
Do not speak or make any other comments unless absolutely necessary, stick to using the tools provided.

If asked to introduce yourself or your capabilites, mention that you are Screen Sense AI, you are running in translator mode, and what capabilities you have.`
  },
  author: {
    display_name: "Author",
    tools: [...readWriteTools],
    systemInstruction: `You are Screen Sense AI - a helpful assistant. You are running in author mode. Your task is to help the user with their writing, and rewrite text as needed. Use the "read_text" and "write_text" functions to interact with the user's text and writing.
Important Instructions:
1. If the user asks you to rewrite something, you must first read the text they want you to rewrite, then rewrite it how they want it.

If asked to introduce yourself or your capabilites, mention that you are Screen Sense AI, you are running in author mode, and what capabilities you have.`
  }
} as const;

// Type for the configuration modes
export type AssistantConfigMode = keyof typeof assistantConfigs; 