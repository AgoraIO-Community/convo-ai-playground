// src/components/VideoTile.tsx
"use client";
import React, { useRef, useEffect } from "react";
import { MdMic, MdMicOff } from "react-icons/md";
import type { ILocalVideoTrack, IRemoteVideoTrack } from "agora-rtc-sdk-ng";

interface VideoTileProps {
  uid: string | number;
  name: string;
  isLocal: boolean;
  track: ILocalVideoTrack | IRemoteVideoTrack | null;
  micMuted: boolean;
  videoMuted: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({
  uid,
  name,
  isLocal,
  track,
  micMuted,
  videoMuted,
}) => {
  const videoContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!videoContainerRef.current) return;

    if (track && !videoMuted) {
      track.play(videoContainerRef.current);
    }

    return () => {
      if (track) {
        track.stop();
      }
    };
  }, [track, videoMuted]);

  return (
    // bg-black is already fine as it's a fixed color in both themes
    // Use h-full w-full to fill parent container, parent controls dimensions
    <div
      id={`user-${uid}`}
      ref={videoContainerRef}
      className="relative bg-black rounded-lg overflow-hidden h-full w-full flex items-center justify-center text-white shadow-lg"
    >
      {/* Video Placeholder */}
      {videoMuted && (
        <div className="video-placeholder absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-lg opacity-80">
          {/* UPDATED: Using direct Tailwind default colors for avatar background */}
          <div className="w-20 h-20 rounded-full bg-gray-700 dark:bg-gray-600 flex items-center justify-center text-4xl text-white mb-2 mx-auto">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="font-semibold">
            {isLocal ? "Local User" : "Video Off"}
          </div>
        </div>
      )}

      {/* Username Label with Mute Indicators */}
      {/* UPDATED: Using direct Tailwind default colors for label background/text/icons */}
      <div className="absolute bottom-2 left-2 bg-gray-800 dark:bg-gray-900 bg-opacity-70 px-3 py-1 rounded-md text-base z-10 flex items-center space-x-2 text-white">
        <span className="font-medium">
          {isLocal ? `${name} (You)` : name}
        </span>
        <span className="flex items-center">
          {micMuted ? (
            <MdMicOff
              size={20}
              className="text-red-500 dark:text-red-400"
              title="Mic Muted"
            />
          ) : (
            <MdMic
              size={20}
              className="text-green-500 dark:text-green-400"
              title="Mic On"
            />
          )}
        </span>
      </div>
    </div>
  );
};

export default VideoTile;
