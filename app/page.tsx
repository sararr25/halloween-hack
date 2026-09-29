import { redirect } from "next/navigation";

// The experience is not built yet; the lab hosts the first scene.
export default function Home() {
  redirect("/lab");
}
