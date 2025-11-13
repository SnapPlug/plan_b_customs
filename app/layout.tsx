import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PLAN B 관세사무소 - 핸드캐리 수입 인보이스 AI 자동 입력 서비스",
  description: "AI를 활용한 수입 영수증 자동 입력 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased font-pretendard">
        {children}
      </body>
    </html>
  );
}
