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

import cn from "classnames";

import { memo, ReactNode, RefObject, useEffect, useRef, useState } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { UseMediaStreamResult } from "../../hooks/use-media-stream-mux";
import { useScreenCapture } from "../../hooks/use-screen-capture";
import { useWebcam } from "../../hooks/use-webcam";
import { AudioRecorder } from "../../lib/audio-recorder";
import AudioPulse from "../audio-pulse/AudioPulse";
import "./control-tray.scss";

export type ControlTrayProps = {
  videoRef: RefObject<HTMLVideoElement>;
  children?: ReactNode;
  supportsVideo: boolean;
  onVideoStreamChange?: (stream: MediaStream | null) => void;
  modes: { value: string; label: string }[];
  selectedOption: { value: string; label: string };
  setSelectedOption: (option: { value: string; label: string }) => void;
  apiKey: string;
  onSetTempApiKey: (apiKey: string) => void;
  showApiKeyInput: boolean;
  onShowApiKeyInput: (show: boolean) => void;
};

type MediaStreamButtonProps = {
  isStreaming: boolean;
  onIcon: string;
  offIcon: string;
  start: () => Promise<any>;
  stop: () => any;
};

/**
 * button used for triggering webcam or screen-capture
 */
const MediaStreamButton = memo(
  ({ isStreaming, onIcon, offIcon, start, stop }: MediaStreamButtonProps) =>
    isStreaming ? (
      <button className="action-button" onClick={stop}>
        <span className="material-symbols-outlined">{onIcon}</span>
      </button>
    ) : (
      <button className="action-button" onClick={start}>
        <span className="material-symbols-outlined">{offIcon}</span>
      </button>
    ),
);

function ControlTray({
  videoRef,
  children,
  onVideoStreamChange = () => { },
  supportsVideo,
  modes,
  selectedOption,
  setSelectedOption,
  apiKey,
  onSetTempApiKey,
  showApiKeyInput,
  onShowApiKeyInput,
}: ControlTrayProps) {
  const videoStreams = [useWebcam(), useScreenCapture()];
  const [activeVideoStream, setActiveVideoStream] =
    useState<MediaStream | null>(null);
  const [webcam, screenCapture] = videoStreams;
  const [inVolume, setInVolume] = useState(0);
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const renderCanvasRef = useRef<HTMLCanvasElement>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [iconCarouselIndex, setIconCarouselIndex] = useState(0);

  const { client, connected, connect, disconnect, volume } =
    useLiveAPIContext();

  useEffect(() => {
    if (!connected && connectButtonRef.current) {
      connectButtonRef.current.focus();
    }
  }, [connected]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--volume",
      `${Math.max(5, Math.min(inVolume * 200, 8))}px`,
    );
  }, [inVolume]);

  // Add error message state
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    let timeoutId: number;
    if (showError) {
      timeoutId = window.setTimeout(() => setShowError(false), 3000);
    }
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [showError]);

  // Add error message styles
  const errorMessageStyle = {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--Red-500)',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '8px',
    marginBottom: '8px',
    whiteSpace: 'nowrap',
    opacity: showError ? 1 : 0,
    transition: 'opacity 0.2s ease-in-out',
    pointerEvents: 'none',
  } as const;

  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([
        {
          mimeType: "audio/pcm;rate=16000",
          data: base64,
        },
      ]);
    };
    if (connected && !muted && audioRecorder) {
      audioRecorder.on("data", onData).on("volume", setInVolume).start();
    } else {
      audioRecorder.stop();
    }
    return () => {
      audioRecorder.off("data", onData).off("volume", setInVolume);
    };
  }, [connected, client, muted, audioRecorder]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = activeVideoStream;
    }

    let timeoutId = -1;

    function sendVideoFrame() {
      const video = videoRef.current;
      const canvas = renderCanvasRef.current;

      if (!video || !canvas) {
        return;
      }

      const ctx = canvas.getContext("2d")!;
      canvas.width = video.videoWidth * 0.25;
      canvas.height = video.videoHeight * 0.25;
      if (canvas.width + canvas.height > 0) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 1.0);
        const data = base64.slice(base64.indexOf(",") + 1, Infinity);
        client.sendRealtimeInput([{ mimeType: "image/jpeg", data }]);
      }
      if (connected) {
        timeoutId = window.setTimeout(sendVideoFrame, 1000 / 0.5);
      }
    }
    if (connected && activeVideoStream !== null) {
      requestAnimationFrame(sendVideoFrame);
    }
    return () => {
      clearTimeout(timeoutId);
    };
  }, [connected, activeVideoStream, client, videoRef]);

  //handler for swapping from one video-stream to the next
  const changeStreams = (next?: UseMediaStreamResult) => async () => {
    if (next) {
      try {
        const mediaStream = await next.start();
        setActiveVideoStream(mediaStream);
        onVideoStreamChange(mediaStream);
      } catch (error) {
        // Silently handle cancellation, but still log other errors
        if (!(error instanceof Error && error.message === 'Selection cancelled')) {
          console.error('Error changing streams:', error);
        }
        setActiveVideoStream(null);
        onVideoStreamChange(null);
      }
    } else {
      setActiveVideoStream(null);
      onVideoStreamChange(null);
    }

    videoStreams.filter((msr) => msr !== next).forEach((msr) => msr.stop());
  };

  useEffect(() => {
    setSelectedOption(modes[carouselIndex]);
  }, [carouselIndex, modes, setSelectedOption]);
  const handleCarouselChange = (direction: 'next' | 'prev') => {
    setCarouselIndex(prevIndex => {
      const newIndex = direction === 'next'
        ? (prevIndex + 1) % modes.length
        : (prevIndex - 1 + modes.length) % modes.length;
      return newIndex;
    });
  };

  const slide1 = <div
    style={{
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '12px',
      // border: '2px solid red',
      height: '80px'
    }}
  >
    <div className={cn("connection-container", { connected })}>
      <div className="connection-button-container">
        <div style={errorMessageStyle}>
          Please add your API key by clicking the key icon ⚿ in the top right
        </div>
        <button
          ref={connectButtonRef}
          className={cn("action-button connect-toggle", { connected })}
          onClick={() => {
            const apiKeyMatch = client.url.match(/[?&]key=([^&]*)/);
            const apiKey = apiKeyMatch ? decodeURIComponent(apiKeyMatch[1]) : "";

            if (!connected && !apiKey) {
              setShowError(true);
              return;
            }
            connected ? disconnect() : connect();
          }}
        >
          <span className="material-symbols-outlined filled">
            {connected ? "pause" : "play_arrow"}
          </span>
        </button>
      </div>
      <span className="text-indicator">Streaming</span>
    </div>

    <div className="connection-container">
      <div className="connection-button-container">
        <button
          className="action-button connect-toggle"
          onClick={() => {
            onSetTempApiKey(apiKey);
            onShowApiKeyInput(!showApiKeyInput);
          }}
        >
          <span className="material-symbols-outlined filled">key</span>
        </button>
      </div>
      <span className="text-indicator">Streaming</span>
    </div>
  </div>
  const slide2 = <div
    style={{
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '12px',
      // border: '2px solid red',
      height: '80px'
    }}
  >
    <div className="connection-container">
      <div className="connection-button-container">
        <button
          className={cn("action-button mic-button")}
          onClick={() => setMuted(!muted)}
        >
          {!muted ? (
            <span className="material-symbols-outlined filled">mic</span>
          ) : (
            <span className="material-symbols-outlined filled">mic_off</span>
          )}
        </button>
      </div>
    </div>
    <div className="connection-container">
      <div className="connection-button-container">
        <div className="action-button no-action outlined">
          <AudioPulse volume={volume} active={connected} hover={false} />
        </div>
      </div>
    </div>
  </div>
  const slide3 = <div
    style={{
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '12px',
      // border: '2px solid red',
      height: '80px'
    }}
  >
    <div className="connection-container">
      <div className="connection-button-container">
        <MediaStreamButton
          isStreaming={screenCapture.isStreaming}
          start={changeStreams(screenCapture)}
          stop={changeStreams()}
          onIcon="cancel_presentation"
          offIcon="present_to_all"
        />
      </div>
    </div>
    <div className="connection-container">
      <div className="connection-button-container">
        <MediaStreamButton
          isStreaming={webcam.isStreaming}
          start={changeStreams(webcam)}
          stop={changeStreams()}
          onIcon="videocam_off"
          offIcon="videocam"
        />
      </div>
    </div>
  </div>
  const icons = [
    slide1, slide2, slide3
  ]
  return (<>
    <section className="control-tray">
      <canvas style={{ display: "none" }} ref={renderCanvasRef} />
      <div className="actions-nav">
        <button
          className="action-button"
          onClick={() => setIconCarouselIndex((iconCarouselIndex - 1 + 3) % 3)}
          style={{
            width: '20px',
            height: '32px',
            background: 'transparent',
          }}
        >
          <span className="material-symbols-outlined">
            chevron_left
          </span>
        </button>

        <div
          className="carousel-content"
          style={{
            width: '300px',
            // border: '2px solid red',
            textAlign: 'center',
            justifyContent: 'center'
          }}
        >
          <div className="carousel-item">
            {icons[iconCarouselIndex]}
          </div>
        </div>

        <button
          className="action-button"
          onClick={() => setIconCarouselIndex((iconCarouselIndex + 1) % 3)}
          style={{
            width: '20px',
            height: '32px',
            background: 'transparent',
          }}
        >
          <span className="material-symbols-outlined">
            chevron_right
          </span>
        </button>
      </div>

      <div className="carousel-container agents-carousel" style={{ display: 'flex', alignItems: 'center' }}>
        <button
          className="carousel-button action-button"
          onClick={() => {
            handleCarouselChange('prev');
            disconnect();
          }}
          style={{
            position: 'relative',
            width: '15%',
            height: '32px',
            background: 'transparent',
          }}
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>

        <div className="carousel-content" style={{
          width: '70%',
          textAlign: 'center',
          justifyContent: 'center'
        }}>
          <div className="carousel-slide">
            <span className="carousel-text">{selectedOption.label}</span>
          </div>
        </div>

        <button
          className="carousel-button action-button"
          onClick={() => {
            handleCarouselChange('next');
            disconnect();
          }}
          style={{
            width: '15%',
            height: '32px',
            background: 'transparent',
          }}
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
      {/* <div className="control-tray-container">
        <nav className={cn("actions-nav", { disabled: !connected })}>
          <button
            className={cn("action-button mic-button")}
            onClick={() => setMuted(!muted)}
          >
            {!muted ? (
              <span className="material-symbols-outlined filled">mic</span>
            ) : (
              <span className="material-symbols-outlined filled">mic_off</span>
            )}
          </button>

          <div className="action-button no-action outlined">
            <AudioPulse volume={volume} active={connected} hover={false} />
          </div>

          {supportsVideo && (
            <>
              <MediaStreamButton
                isStreaming={screenCapture.isStreaming}
                start={changeStreams(screenCapture)}
                stop={changeStreams()}
                onIcon="cancel_presentation"
                offIcon="present_to_all"
              />
              <MediaStreamButton
                isStreaming={webcam.isStreaming}
                start={changeStreams(webcam)}
                stop={changeStreams()}
                onIcon="videocam_off"
                offIcon="videocam"
              />
            </>
          )}
          {children}
        </nav>
      </div> */}
    </section>
  </>
  );
}

export default memo(ControlTray);

