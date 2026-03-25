import { ImageResponse } from "next/og";

import { SocialCard } from "@/components/social-card";

export const alt = "MooSQA | Music Radar";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<SocialCard />, size);
}
