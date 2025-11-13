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
    // 사용자 정보는 유지하고 업로드 화면만 닫음
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
      <main className="flex min-h-screen w-full max-w-full flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">

        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
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
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            핸드캐리 수입 인보이스
            <br/> AI 자동 입력 서비스
          </h1>
          
        </div>

        {showUpload ? (
          <div className="w-full space-y-6">
            <ReceiptUpload 
              onFileSelect={handleFileSelect}
              invoiceName={userInfo?.invoiceName}
              userName={userInfo?.name}
              onComplete={handleUploadComplete}
            />
            <button
              onClick={handleUploadCancel}
              className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ← 뒤로가기
            </button>
          </div>
        ) : showUserInfo ? (
          <UserInfoForm
            onSubmit={handleUserInfoSubmit}
            onCancel={handleUserInfoCancel}
          />
        ) : (
          <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
            <button
              onClick={() => setShowUserInfo(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[4px] bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            >
              시작하기
            </button>
            <a
              className="flex h-12 w-full items-center justify-center rounded-[4px] border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
              href=""
              target="_blank"
              rel="noopener noreferrer"
            >
              문의하기
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
