import type { Metadata } from "next";
import styles from "./privacy.module.css";

export const metadata: Metadata = { title: "recovery · privacy" };

// Plain words, out of character: what the experience keeps and what it never sends.
// Keep in sync with lib/registry/db.ts (what is stored) and lib/story/registry.ts (when).
export default function Privacy() {
  return (
    <main className={styles.page}>
      <h1>Privacy</h1>
      <p className={styles.lead}>
        RECOVERY is an interactive horror story. It pretends to watch you. This page says what it actually keeps.
      </p>

      <h2>Camera and microphone</h2>
      <p>
        If you allow them, the camera and microphone are processed only inside your browser, on your device: face
        tracking, blinks, hand gestures, the short room recording and the stills in the case file. No frame and no
        audio is ever uploaded, stored on a server or shared. When you close the tab they are gone.
      </p>

      <h2>What is stored on our server</h2>
      <p>When you type an operator name at the end, the case registry keeps:</p>
      <ul>
        <li>the operator name you typed (any name works; it does not need to be your real one)</li>
        <li>the time your session started and the time it ended</li>
        <li>a random code used for the &ldquo;pass it on&rdquo; link</li>
        <li>if you arrived through someone&apos;s link, which registry entry that link belongs to</li>
      </ul>
      <p>
        Nothing else: no email, no account, no photos, no voice, no face data, no location. The registry is a Postgres
        database hosted by Neon in the EU (Frankfurt); the site is hosted by Vercel.
      </p>

      <h2>The &ldquo;pass it on&rdquo; link</h2>
      <p>
        If you share your link, whoever opens it sees the operator name you typed, inside the story. Nothing is sent
        to anyone unless you share the link yourself.
      </p>

      <h2>On your device</h2>
      <p>
        Your browser remembers a few things locally (your operator name, whether you muted the sound, whether you saw
        the briefing) so the story can greet you when you come back. You can clear them by clearing this site&apos;s
        data in your browser.
      </p>

      <h2>The calendar reminder</h2>
      <p>&ldquo;Add reminder&rdquo; downloads a calendar file made in your browser. It is not sent anywhere.</p>

      <h2>Deleting your entry</h2>
      {/* TODO(owner): contact address and retention period to confirm before publishing */}
      <p>To have your registry entry deleted, write to us with the operator name and the date you played.</p>
    </main>
  );
}
