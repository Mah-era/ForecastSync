import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ForecastSync",
  description: "Advanced SCM demand planning, forecasting, import, market research, and reporting dashboard."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
