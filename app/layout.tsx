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
      <head>
        {/* Pretendard 폰트 CDN */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.7/dist/web/static/pretendard.css"
          as="style"
        />
      </head>
      <body className="antialiased font-pretendard">
        {children}
      </body>
    </html>
  );
}
