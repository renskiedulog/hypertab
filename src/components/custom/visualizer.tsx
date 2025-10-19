"use client";
import { useEffect, useState } from "react";
import { Volume2, Volume1, VolumeX, Volume, Music } from "lucide-react";

export default function Visualizer() {
  const [videoInfo, setVideoInfo] = useState<any>(null);

  useEffect(() => {
    if (!chrome?.runtime?.sendMessage) return;

    chrome.runtime.sendMessage({ type: "REQUEST_INFO" }, (res: any) => {
      if (res) setVideoInfo(res);
      else setVideoInfo(null);
    });

    const listener = (msg: any) => {
      if (msg.type === "YOUTUBE_INFO") setVideoInfo(msg.data);
      if (msg.type === "YOUTUBE_INFO_CLEARED") setVideoInfo(null);
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getVolumeIcon = (v: number) => {
    if (v === 0) return <VolumeX className="w-5 h-5" />;
    if (v < 0.33) return <Volume className="w-5 h-5" />;
    if (v < 0.66) return <Volume1 className="w-5 h-5" />;
    return <Volume2 className="w-5 h-5" />;
  };

  const getPlayPauseIcon = (paused: boolean) =>
    paused ? (
      <Music className="w-10 h-10 text-red-400 translate-y-1" />
    ) : (
      <Music className="w-10 h-10 text-green-400 translate-y-1" />
    );

  return (
    <div className="flex flex-col items-center max-w-3xl justify-center text-white absolute bottom-0 left-1/2 -translate-x-1/2 p-2">
      {videoInfo ? (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3">
            {getPlayPauseIcon(videoInfo?.paused)}
            <h2 className="text-3xl font-bold line-clamp-1 break-all">
              {videoInfo?.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 text-white">
            <div className="flex items-center gap-2 text-base">
              <span>{formatTime(videoInfo?.currentTime)}</span>
              <span>/</span>
              <span>{formatTime(videoInfo?.duration)}</span>
            </div>

            <div className="flex items-center gap-2 text-base">
              {getVolumeIcon(videoInfo?.volume)}
              <span>{videoInfo?.volume}%</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-gray-600 text-sm">No YouTube video detected</p>
      )}
    </div>
  );
}
