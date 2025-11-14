'use client';

import Image from "next/image";
import { useState } from "react";
import ReceiptUpload, { DriveUploadResult } from "../components/ReceiptUpload";
import UserInfoForm, { UserInfo } from "../components/UserInfoForm";

export default function Home() {
  const [showUserInfo, setShowUserInfo] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  /**
   * 사용자 정보 제출 핸들러
   */
  const handleUserInfoSubmit = (info: UserInfo) => {
    setUserInfo(info);
    console.log('사용자 정보:', info);
    setShowUserInfo(false);
    setShowUpload(true);
  };

  /**
   * 사용자 정보 입력 취소 핸들러
   */
  const handleUserInfoCancel = () => {
    setShowUserInfo(false);
  };

  /**
   * 업로드 화면에서 뒤로가기 핸들러
   */
  const handleUploadCancel = () => {
    setShowUpload(false);
    setShowUserInfo(true);
  };

  /**
   * 업로드 완료 핸들러 - 홈화면으로 리셋
   */
  const handleUploadComplete = () => {
    setShowUpload(false);
    setShowUserInfo(false);
    setUserInfo(null);
  };

  const handleFileSelect = (file: File, driveMeta?: DriveUploadResult) => {
    console.log('선택된 파일:', file.name);
    console.log('업로드 결과:', driveMeta);
    console.log('사용자 정보:', userInfo);
    // TODO: 파일과 사용자 정보를 함께 서버로 전송하거나 처리하는 로직 추가
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="relative flex min-h-screen w-full max-w-full flex-col items-center gap-10 px-4 py-10 bg-white dark:bg-black">

        <header className="flex flex-col items-center gap-6 text-center relative w-full max-w-3xl pt-4">
          {showUpload || showUserInfo ? (
            <>
              <button
                onClick={showUpload ? handleUploadCancel : handleUserInfoCancel}
                className="absolute left-0 top-3 sm:left-2 sm:top-4 z-10 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="뒤로가기"
              >
                ←
              </button>
              <div className="relative w-24 h-24 sm:w-32 sm:h-32">
                <Image
                  src="/PlanBCustoms_Logo.png"
                  alt="PLAN B 관세사무소 로고"
                  fill
                  sizes="(max-width: 640px) 96px, 128px"
                  className="object-contain"
                  priority
                />
              </div>
            </>
          ) : (
            <div className="relative w-32 h-32 sm:w-40 sm:h-40">
              <Image
                src="/PlanBCustoms_Logo.png"
                alt="PLAN B 관세사무소 로고"
                fill
                sizes="(max-width: 640px) 128px, 160px"
                className="object-contain"
                priority
              />
            </div>
          )}
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            수입 인보이스 영수증
            <br/> AI 자동 처리 서비스
          </h1>
        </header>

        <section className="flex w-full flex-1 items-center justify-center">
          <div className="w-full flex flex-col items-center gap-6">
            {showUpload ? (
              <div className="w-full space-y-6">
                <ReceiptUpload 
                  onFileSelect={handleFileSelect}
                  invoiceName={userInfo?.invoiceName}
                  userName={userInfo?.name}
                  onComplete={handleUploadComplete}
                />
              </div>
            ) : showUserInfo ? (
              <UserInfoForm
                onSubmit={handleUserInfoSubmit}
                onCancel={handleUserInfoCancel}
              />
            ) : (
              <div className="flex flex-row gap-4 text-base font-medium w-full max-w-md justify-center">
                <button
                  onClick={() => setShowUserInfo(true)}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[4px] bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px] md:flex-none"
                >
                  시작하기
                </button>
                <a
                  className="flex h-12 flex-1 items-center justify-center rounded-[4px] border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px] md:flex-none"
                  href=""
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  문의하기
                </a>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
