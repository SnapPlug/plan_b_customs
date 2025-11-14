/**
 * ReceiptUpload Component
 * 
 * 영수증 이미지 파일을 업로드하는 컴포넌트입니다.
 * 드래그 앤 드롭 및 파일 선택 기능을 제공하며, 여러 파일 동시 업로드를 지원합니다.
 * 
 * @param onFileSelect - 파일 선택 시 호출되는 콜백 함수
 */

'use client';

import { useState, useCallback, DragEvent, ChangeEvent } from 'react';
import Image from 'next/image';
import { Check, X, Loader2, Camera } from 'lucide-react';
import Toast from './Toast';

export interface DriveUploadResult {
  fileId: string;
  name?: string | null;
  webViewLink?: string | null;
  webContentLink?: string | null;
  url?: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
  invoiceName?: string; // 인보이스명 (구글 시트 저장용)
  userName?: string; // 사용자 이름 (구글 시트 저장용)
  userPhone?: string; // 사용자 전화번호 (구글 시트 저장용)
}

interface FileUploadState {
  file: File;
  preview: string;
  status: 'idle' | 'uploading' | 'success' | 'error';
  result?: DriveUploadResult;
  error?: string;
}

interface ReceiptUploadProps {
  /** 파일 선택 시 호출되는 콜백 함수 */
  onFileSelect?: (file: File, meta?: DriveUploadResult) => void;
  /** 인보이스 이름 (Cloudinary 식별자로 사용) */
  invoiceName?: string;
  /** 사용자 이름 */
  userName?: string;
  /** 사용자 전화번호 */
  userPhone?: string;
  /** 업로드 완료 시 호출되는 콜백 함수 */
  onComplete?: () => void;
}

export default function ReceiptUpload({ onFileSelect, invoiceName, userName, userPhone, onComplete }: ReceiptUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [showToast, setShowToast] = useState(false);

  /**
   * 모든 파일의 업로드가 완료되었는지 확인
   * (업로드 중인 파일이 없고, 최소 하나의 파일이 있으면 완료)
   */
  const isAllUploadsComplete = files.length > 0 && files.every(
    (file) => file.status === 'success' || file.status === 'error'
  );

  /**
   * 파일 유효성 검사
   * 이미지 파일(JPEG, PNG)만 허용
   */
  const validateFile = (file: File): string | null => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
      return 'JPEG 또는 PNG 이미지 파일만 업로드 가능합니다.';
    }

    if (file.size > maxSize) {
      return '파일 크기는 10MB 이하여야 합니다.';
    }

    return null;
  };

  /**
   * 파일 미리보기 생성
   */
  const createPreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /**
   * Cloudinary 업로드
   */
  const uploadToCloudinary = useCallback(async (file: File, index: number) => {
    const formData = new FormData();
    formData.append('file', file);
    
    // 인보이스 이름이 있으면 함께 전송
    if (invoiceName) {
      formData.append('invoiceName', invoiceName);
    }
    
    // 파일 인덱스 전송 (public_id 생성용)
    formData.append('fileIndex', index.toString());
    
    // 사용자 정보 전송 (구글 시트 저장용)
    if (userName) {
      formData.append('userName', userName);
    }
    if (userPhone) {
      formData.append('userPhone', userPhone);
    }

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message =
        typeof errorBody?.message === 'string'
          ? errorBody.message
          : '파일 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.';
      throw new Error(message);
    }

    return (await response.json()) as DriveUploadResult;
  }, [invoiceName, userName, userPhone]);

  /**
   * 파일 업로드 처리
   */
  const uploadFile = useCallback(
    async (fileState: FileUploadState, index: number) => {
      // 업로드 중 상태로 변경
      setFiles((prev) =>
        prev.map((f) =>
          f.file === fileState.file ? { ...f, status: 'uploading' as const } : f
        )
      );

      try {
        const result = await uploadToCloudinary(fileState.file, index);
        
        // 업로드 성공 상태로 변경
        setFiles((prev) =>
          prev.map((f) =>
            f.file === fileState.file
              ? { ...f, status: 'success' as const, result }
              : f
          )
        );

        if (onFileSelect) {
          onFileSelect(fileState.file, result);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
        
        // 업로드 실패 상태로 변경
        setFiles((prev) =>
          prev.map((f) =>
            f.file === fileState.file
              ? { ...f, status: 'error' as const, error: errorMessage }
              : f
          )
        );
      }
    },
    [onFileSelect, uploadToCloudinary]
  );

  /**
   * 파일 추가 처리
   */
  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const fileArray = Array.from(fileList);
      const validFiles: File[] = [];
      const invalidFiles: { file: File; error: string }[] = [];

      // 파일 유효성 검사
      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          invalidFiles.push({ file, error });
        } else {
          validFiles.push(file);
        }
      }

      // 유효하지 않은 파일이 있으면 알림
      if (invalidFiles.length > 0) {
        const errorMessages = invalidFiles.map(({ file, error }) => `${file.name}: ${error}`).join('\n');
        alert(`다음 파일을 업로드할 수 없습니다:\n${errorMessages}`);
      }

      if (validFiles.length === 0) {
        return;
      }

      // 새 파일들에 대한 미리보기 생성 및 상태 추가
      const newFiles: FileUploadState[] = await Promise.all(
        validFiles.map(async (file) => {
          const preview = await createPreview(file);
          return {
            file,
            preview,
            status: 'idle' as const,
          };
        })
      );

      // 파일 목록에 추가
      // 기존 파일 개수를 기준으로 인덱스 계산 (1부터 시작)
      const existingFileCount = files.length;
      setFiles((prev) => [...prev, ...newFiles]);

      // 자동으로 업로드 시작 (각 파일별로 순차적으로)
      for (let i = 0; i < newFiles.length; i++) {
        const index = existingFileCount + i + 1; // 1부터 시작하는 인덱스
        await uploadFile(newFiles[i], index);
      }
    },
    [uploadFile, files]
  );

  /**
   * 드래그 앤 드롭 핸들러
   */
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const fileList = e.dataTransfer.files;
    if (fileList && fileList.length > 0) {
      void handleFiles(fileList);
    }
  };

  /**
   * 파일 선택 핸들러
   */
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      void handleFiles(fileList);
    }
    // 같은 파일을 다시 선택할 수 있도록 input 초기화
    e.target.value = '';
  };

  /**
   * 파일 제거 (로컬 상태 및 Cloudinary에서 삭제)
   */
  const handleRemove = async (fileToRemove: File) => {
    // 파일 상태에서 찾기
    const fileState = files.find((f) => f.file === fileToRemove);
    
    // Cloudinary에서 삭제 (업로드가 성공한 경우에만)
    if (fileState?.status === 'success' && fileState.result?.fileId) {
      try {
        const response = await fetch('/api/upload/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            public_id: fileState.result.fileId,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          console.error('Cloudinary 삭제 실패:', errorBody);
          // Cloudinary 삭제 실패해도 로컬에서는 제거 (사용자 경험 개선)
        } else {
          console.log('Cloudinary에서 이미지 삭제 완료:', fileState.result.fileId);
        }
      } catch (error) {
        console.error('Cloudinary 삭제 중 오류:', error);
        // Cloudinary 삭제 실패해도 로컬에서는 제거 (사용자 경험 개선)
      }
    }

    // 로컬 상태에서 제거
    setFiles((prev) => prev.filter((f) => f.file !== fileToRemove));
  };

  /**
   * 모든 파일 제거 (로컬 상태 및 Cloudinary에서 삭제)
   */
  const handleRemoveAll = async () => {
    // 업로드가 성공한 모든 파일을 Cloudinary에서 삭제
    const successfulFiles = files.filter(
      (f) => f.status === 'success' && f.result?.fileId
    );

    // 병렬로 모든 삭제 요청 실행
    await Promise.allSettled(
      successfulFiles.map(async (fileState) => {
        try {
          const response = await fetch('/api/upload/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              public_id: fileState.result!.fileId,
            }),
          });

          if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            console.error('Cloudinary 삭제 실패:', errorBody);
          } else {
            console.log('Cloudinary에서 이미지 삭제 완료:', fileState.result!.fileId);
          }
        } catch (error) {
          console.error('Cloudinary 삭제 중 오류:', error);
        }
      })
    );

    // 로컬 상태에서 모든 파일 제거
    setFiles([]);
  };

  return (
    <div className="w-full pt-48 sm:pt-56 md:pt-0 space-y-4">
      {/* 파일 목록 */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              업로드 된 영수증 ({files.length}개)
            </h3>
            {files.length > 0 && (
              <button
                onClick={handleRemoveAll}
                className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              >
                전체 삭제
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {files.map((fileState) => (
              <div
                key={`${fileState.file.name}-${fileState.file.lastModified}`}
                className="relative border border-gray-300 dark:border-gray-700 rounded-[4px] overflow-hidden bg-gray-50 dark:bg-gray-900"
              >
                {/* 미리보기 */}
                <div className="relative w-full aspect-square bg-gray-100 dark:bg-gray-800">
                  <Image
                    src={fileState.preview}
                    alt={fileState.file.name}
                    fill
                    className="object-contain"
                  />
                  
                  {/* 상태 오버레이 */}
                  {fileState.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <svg
                        className="h-8 w-8 animate-spin text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
                        ></path>
                      </svg>
                    </div>
                  )}
                  
                </div>

                {/* 파일 정보 */}
                <div className="p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate flex-1">
                      {fileState.file.name}
                    </p>
                    {fileState.status === 'uploading' && (
                      <Loader2 className="w-3 h-3 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
                    )}
                    {fileState.status === 'success' && (
                      <div className="bg-green-500 rounded-full p-1 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </div>
                    )}
                    {fileState.status === 'error' && (
                      <div className="bg-red-500 rounded-full p-1 flex items-center justify-center flex-shrink-0">
                        <X className="w-3 h-3 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(fileState.file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  
                 
                  
                  {fileState.status === 'error' && fileState.error && (
                    <p className="text-xs text-red-600 dark:text-red-400 truncate">
                      {fileState.error}
                    </p>
                  )}

                  {/* 제거 버튼 */}
                  <button
                    onClick={() => handleRemove(fileState.file)}
                    disabled={fileState.status === 'uploading'}
                    className="mt-2 w-full px-2 py-1 text-xs text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed dark:text-red-400 dark:hover:text-red-300 transition-colors rounded-[4px] border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    aria-label="파일 제거"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 업로드 영역 */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center gap-3
          w-full max-w-md mx-auto
          border-2 border-dashed rounded-[4px]
          transition-colors cursor-pointer
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
              : 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900'
          }
          hover:border-gray-400 dark:hover:border-gray-600
        `}
      >
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          onChange={handleFileChange}
          multiple
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="영수증 이미지 업로드"
        />

        <div className="flex flex-col items-center justify-center gap-3 py-8 px-6">
          <Camera className="w-10 h-10 text-gray-400 dark:text-gray-500" strokeWidth={2} />
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {files.length > 0 ? '영수증을 추가해주세요' : '영수증을 업로드해주세요'}
          </p>
        </div>
      </div>

      {/* 완료하기 버튼 */}
      {isAllUploadsComplete && (
        <div className="pt-4">
          <button
            onClick={() => {
              setShowToast(true);
            }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[4px] bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            완료하기
          </button>
        </div>
      )}

      {/* Toast 메시지 */}
      {showToast && (
        <Toast
          message="영수증을 업로드해주셔서 감사합니다."
          duration={2000}
          onClose={() => {
            setShowToast(false);
            if (onComplete) {
              onComplete();
            }
          }}
        />
      )}
    </div>
  );
}

