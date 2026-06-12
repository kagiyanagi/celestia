"use client";

import { useEffect, useRef } from "react";

interface AnimeCommunityCommentsProps {
  aniListId: number;
  malId?: number | null;
  episodeNumber?: number | null;
}

interface AnimeCommunityConfig {
  AniList_ID: string;
  mediaType: string;
  MAL_ID?: string;
  episodeChapterNumber?: string;
}

interface CustomWindow extends Window {
  theAnimeCommunityConfig?: AnimeCommunityConfig;
  theAnimeCommunity?: {
    reload?: () => void;
  };
}

interface CustomElement extends HTMLDivElement {
  __animeCommunityUnmount?: () => void;
}

export function AnimeCommunityComments({
  aniListId,
  malId,
  episodeNumber,
}: AnimeCommunityCommentsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const customWindow = window as unknown as CustomWindow;

    // 1. Prepare configuration values as strings
    const config: AnimeCommunityConfig = {
      AniList_ID: aniListId.toString(),
      mediaType: "anime",
    };

    if (malId) {
      config.MAL_ID = malId.toString();
    }

    if (episodeNumber != null) {
      config.episodeChapterNumber = episodeNumber.toString();
    } else {
      config.episodeChapterNumber = "0";
    }

    // 2. Set the configuration on the global window object
    customWindow.theAnimeCommunityConfig = config;

    const scriptId = "anime-community-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const reloadWidget = () => {
      if (customWindow.theAnimeCommunity?.reload) {
        try {
          customWindow.theAnimeCommunity.reload();
        } catch (e) {
          console.error("Failed to reload Anime Community widget:", e);
        }
      }
    };

    if (!script) {
      // 3. Create and append the widget script if it does not exist
      script = document.createElement("script");
      script.src = "https://theanimecommunity.com/embed.js";
      script.id = scriptId;
      script.defer = true;
      script.onload = reloadWidget;
      document.body.appendChild(script);
    } else {
      // 4. If script already exists in DOM, trigger reload with updated config
      reloadWidget();
    }

    // Capture the current ref value for the cleanup closure
    const currentContainer = containerRef.current;

    // 5. Cleanup on unmount or when details change
    return () => {
      const container = currentContainer as CustomElement | null;
      if (container && container.__animeCommunityUnmount) {
        try {
          container.__animeCommunityUnmount();
        } catch (e) {
          console.error("Failed to unmount Anime Community widget:", e);
        }
      }
      delete customWindow.theAnimeCommunityConfig;
    };
  }, [aniListId, malId, episodeNumber]);

  return (
    <div className="anime-community-comments-container">
      <div
        id="anime-community-comment-section"
        ref={containerRef}
        style={{ width: "100%", minHeight: "200px" }}
      />
    </div>
  );
}
