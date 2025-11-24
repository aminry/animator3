import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "MotionGen Studio",
  description: "Build Lottie animations with the MotionGen backend"
};

export default function RootLayout(props: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{props.children}</body>
    </html>
  );
}
