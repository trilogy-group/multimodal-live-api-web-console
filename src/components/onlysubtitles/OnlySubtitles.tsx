import { type Tool, SchemaType } from "@google/generative-ai";
import { useEffect, useState, useRef, memo } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";
const { ipcRenderer } = window.require('electron');

// Tools configuration
const toolObject: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "render_subtitles",
        description: "Displays subtitles in an overlay window.",
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
        description: "Removes the subtitles overlay window.",
      },
    ],
  },
];

const systemInstructionObject = {
  parts: [
    {
      text: 'You are a helpful subtitles assistant with two main capabilities:\n1. Translation: When asked to translate text, use "render_subtitles" to show the translation and \n2. "remove_subtitles" when done.',
    },
  ],
};

function OnlySubtitlesComponent() {
  const [subtitles, setSubtitles] = useState<string>("");
  const { client, setConfig } = useLiveAPIContext();

  useEffect(() => {
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: ["audio"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
        },
      },
      systemInstruction: systemInstructionObject,
      tools: toolObject,
    });
  }, [setConfig]);

  useEffect(() => {
    const onToolCall = (toolCall: ToolCall) => {
      console.log(`got toolcall`, toolCall);
      toolCall.functionCalls.forEach(fc => {
        if (fc.name === "render_subtitles") {
          const text = (fc.args as any).subtitles;
          setSubtitles(text);
          ipcRenderer.send('update-subtitles', text);
        } else if (fc.name === "remove_subtitles") {
          setSubtitles("");
          ipcRenderer.send('remove-subtitles');
        }
      });

      if (toolCall.functionCalls.length) {
        setTimeout(
          () =>
            client.sendToolResponse({
              functionResponses: toolCall.functionCalls.map((fc) => ({
                response: { output: { success: true } },
                id: fc.id,
              })),
            }),
          200,
        );
      }
    };
    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]);


  return <></>; // Only render the graph container
}

export const OnlySubtitles = memo(OnlySubtitlesComponent); 