/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useRef, useState, useEffect } from "react";
import Select from 'react-select';
import "./App.scss";
import { LiveAPIProvider } from "./contexts/LiveAPIContext";
import SidePanel from "./components/side-panel/SidePanel";
import { Subtitles } from "./components/subtitles/Subtitles";
import { OnlySubtitles } from "./components/onlysubtitles/OnlySubtitles";
import ControlTray from "./components/control-tray/ControlTray";
import cn from "classnames";

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY as string;
if (typeof API_KEY !== "string") {
  throw new Error("REACT_APP_GEMINI_API_KEY in .env");
}

const host = "generativelanguage.googleapis.com";
const uri = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;

const modes = [
  { value: 'general', label: 'General' },
  { value: 'subtitle', label: 'Subtitle' }
];

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [selectedOption, setSelectedOption] = useState({ value: 'general', label: 'General' });
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem("gemini_api_key") || "";
  });
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiKey);

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem("gemini_api_key", apiKey);
    }
  }, [apiKey]);

  const handleApiKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempApiKey.trim()) {
      setApiKey(tempApiKey.trim());
      setShowApiKeyInput(false);
    }
  };

  return (
    <div className="App">
      <LiveAPIProvider url={uri} apiKey={apiKey}>
        <div className="streaming-console">
          <button
            className="action-button api-key-button"
            onClick={() => {
              setTempApiKey(apiKey);
              setShowApiKeyInput(!showApiKeyInput);
            }}
            title="Configure API Key"
          >
            <span className="material-symbols-outlined">key</span>
          </button>

          {showApiKeyInput && (
            <>
              <div className="modal-backdrop" onClick={() => setShowApiKeyInput(false)} />
              <div className="api-key-modal">
                <form onSubmit={handleApiKeySubmit}>
                  <input
                    type="password"
                    placeholder="Enter your API key"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    style={{ 
                      textAlign: 'center',
                      direction: 'ltr',
                      padding: '12px 0'
                    }}
                    className="api-key-input"
                  />
                  <div className="api-key-actions">
                    <button type="button" onClick={() => setShowApiKeyInput(false)}>
                      Cancel
                    </button>
                    <button type="submit" disabled={!tempApiKey.trim()}>
                      Save
                    </button>
                  </div>
                </form>
                <p>
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                    Get API key
                  </a>
                </p>
              </div>
            </>
          )}

          <SidePanel />
          <main>
            <div className="main-app-area">
              {selectedOption.value === 'general' ? <Subtitles /> : <></>}
              {selectedOption.value === 'subtitle' ? <OnlySubtitles /> : <></>}
              <video
                className={cn("stream", {
                  hidden: !videoRef.current || !videoStream,
                })}
                ref={videoRef}
                autoPlay
                playsInline
              />
            </div>

            <ControlTray
              videoRef={videoRef}
              supportsVideo={true}
              onVideoStreamChange={setVideoStream}
              modes={modes}
              selectedOption={selectedOption}
              setSelectedOption={setSelectedOption}
            >
              {/* put your own buttons here */}
            </ControlTray>
            
          </main>
        </div>
      </LiveAPIProvider>
    </div>
  );
}

export default App;
