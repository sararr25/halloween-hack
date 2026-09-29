"use client";

import { useState } from "react";
import Image from "next/image";
import { PHOTOS, photoSrc } from "@/lib/story/content";
import { useStory } from "@/lib/story/store";
import PhotoLens from "./PhotoLens";
import { when } from "./shared";
import styles from "./views.module.css";

// S3 · Photos. Sixteen everyday frames from public/photos. IMG_0418 opens as the Rive
// scene with the lens (its grid thumbnail is a still of it). A listed photo whose file is
// missing fails loudly.

/** One photo file. A missing file is a bug in the content, not something to hide. */
function Shot({ id, sizes, whole }: { id: string; sizes: string; whole?: boolean }) {
  return (
    <Image
      src={photoSrc(id)}
      alt=""
      fill
      sizes={sizes}
      preload={whole}
      style={{ objectFit: whole ? "contain" : "cover" }}
      onError={() => {
        throw new Error(`photo file missing: public${photoSrc(id)}`);
      }}
    />
  );
}
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
            <Shot id={photo.id} sizes="820px" whole />
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
          onClick={() => setOpenId(p.id)}
          aria-label={`${p.id}, ${p.caption}`}
        >
          <Shot id={p.id} sizes="120px" />
          <span>{p.id.replace("IMG_", "")}</span>
        </button>
      ))}
    </div>
  );
}
