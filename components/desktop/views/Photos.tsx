"use client";

import { useState } from "react";
import { PHOTOS } from "@/lib/story/content";
import { useStory } from "@/lib/story/store";
import PhotoLens from "./PhotoLens";
import { when } from "./shared";
import styles from "./views.module.css";

// S3 · Photos. Sixteen everyday frames; IMG_0418 is the only one that is really a photo
// yet (a Rive scene with the WGSL lens). The others are tone placeholders until the
// AI-generated photos exist.
export default function Photos() {
  const { state, dispatch } = useStory();
  const photos = PHOTOS.filter((p) => !p.fromStage || state.stage >= p.fromStage);
  const [openId, setOpenId] = useState<string | null>(null);
  const photo = photos.find((p) => p.id === openId);

  if (photo) {
    return (
      <div className={styles.viewer}>
        <div className={styles.viewerBar}>
          <button className={styles.link} onClick={() => setOpenId(null)}>
            ← all photos
          </button>
          <span>
            {photo.id} · {when(photo.days)}
          </span>
        </div>
        <div className={styles.frame}>
          {photo.key ? (
            <PhotoLens stage={state.stage} onFound={() => dispatch({ type: "clue", id: "photo_figure" })} />
          ) : (
            <div
              className={styles.placeholderPhoto}
              style={{ background: `linear-gradient(160deg, ${photo.tone[0]}, ${photo.tone[1]})` }}
            />
          )}
        </div>
        <p className={styles.caption}>{photo.caption}</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {photos.map((p) => (
        <button
          key={p.id}
          className={styles.thumb}
          style={{ background: `linear-gradient(160deg, ${p.tone[0]}, ${p.tone[1]})` }}
          onClick={() => setOpenId(p.id)}
          aria-label={`${p.id}, ${p.caption}`}
        >
          {p.key && <KeyThumb />}
          <span>{p.id.replace("IMG_", "")}</span>
        </button>
      ))}
    </div>
  );
}

/** Tiny static version of IMG_0418: dark facade, one lit window. */
function KeyThumb() {
  return (
    <svg viewBox="0 0 120 80" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect x="15" y="2" width="90" height="70" fill="#0e131c" />
      {[26, 43, 60, 77, 94].flatMap((x) =>
        [14, 30, 46].map((y) => (
          <rect key={`${x}-${y}`} x={x - 5} y={y - 6} width="10" height="13" fill={x === 77 && y === 30 ? "#8f9aac" : "#0a0d14"} />
        )),
      )}
      <rect x="0" y="70" width="120" height="10" fill="#07090d" />
    </svg>
  );
}
