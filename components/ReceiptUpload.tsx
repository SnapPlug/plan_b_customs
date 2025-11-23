/**
 * ReceiptUpload Component
 * 
 * 영수증 이미지 파일을 업로드하는 컴포넌트입니다.
 * 드래그 앤 드롭 및 파일 선택 기능을 제공하며, 여러 파일 동시 업로드를 지원합니다.
 * 
 * @param onFileSelect - 파일 선택 시 호출되는 콜백 함수
 */

'use client';

import { useState, useCallback, DragEvent, ChangeEvent, useEffect } from 'react';
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
  // Cloudinary 원본 필드들
  asset_id?: string;
  public_id?: string;
  version?: number;
  resource_type?: string;
  type?: string;
  created_at?: string;
  asset_folder?: string;
  display_name?: string;
  secure_url?: string;
  // 전처리된 이미지 URL
  processed_url?: string;
}

interface FileUploadState {
  file: File; // 원본 파일
  rotatedFile?: File; // 회전된 파일 (있으면 업로드 시 사용)
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
  /** 사용자 이메일 */
  userEmail?: string;
  /** 사용자 전화번호 */
  userPhone?: string;
  /** 업로드 완료 시 호출되는 콜백 함수 */
  onComplete?: () => void;
}

const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/drbrltv2kk33ngrh1hf7dbfob2lfknbw';

export default function ReceiptUpload({ onFileSelect, invoiceName, userName, userEmail, userPhone, onComplete }: ReceiptUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);

  /**
   * 컴포넌트 마운트 시 주의사항 팝업 표시
   */
  useEffect(() => {
    setShowWarningModal(true);
  }, []);

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
   * EXIF Orientation 값을 읽어서 이미지 회전 각도 반환
   */
  const getImageOrientation = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const view = new DataView(e.target?.result as ArrayBuffer);
        if (view.getUint16(0, false) !== 0xffd8) {
          resolve(1); // JPEG가 아니면 기본값
          return;
        }
        const length = view.byteLength;
        let offset = 2;
        while (offset < length) {
          if (view.getUint16(offset, false) === 0xffe1) {
            // APP1 마커 발견
            const exifLength = view.getUint16(offset + 2, false);
            if (view.getUint32(offset + 4, false) === 0x45786966) {
              // "Exif" 문자열 확인
              const tiffOffset = offset + 10;
              const isLittleEndian = view.getUint16(tiffOffset, false) === 0x4949;
              if (view.getUint16(tiffOffset + 2, false) !== 0x002a) {
                resolve(1);
                return;
              }
              const ifdOffset = view.getUint32(tiffOffset + 4, isLittleEndian);
              const ifdPointer = tiffOffset + ifdOffset;
              const numEntries = view.getUint16(ifdPointer, isLittleEndian);
              for (let i = 0; i < numEntries; i++) {
                const entryOffset = ifdPointer + 2 + i * 12;
                if (view.getUint16(entryOffset, isLittleEndian) === 0x0112) {
                  // Orientation 태그
                  resolve(view.getUint16(entryOffset + 8, isLittleEndian));
                  return;
                }
              }
            }
            offset += exifLength + 2;
          } else {
            offset += 2;
          }
        }
        resolve(1); // Orientation을 찾지 못하면 기본값
      };
      reader.onerror = () => resolve(1);
      reader.readAsArrayBuffer(file.slice(0, 65536)); // 처음 64KB만 읽기
    });
  };

  /**
   * 이미지를 올바른 방향으로 회전
   */
  const rotateImage = (file: File, orientation: number): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (orientation === 1) {
        // 회전 불필요
        resolve(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }

          // Orientation에 따른 회전 및 크기 조정
          let width = img.width;
          let height = img.height;
          let rotate = 0;
          let flipX = false;
          let flipY = false;

          switch (orientation) {
            case 2:
              flipX = true;
              break;
            case 3:
              rotate = 180;
              break;
            case 4:
              flipY = true;
              break;
            case 5:
              rotate = 90;
              flipX = true;
              [width, height] = [height, width];
              break;
            case 6:
              rotate = 90;
              [width, height] = [height, width];
              break;
            case 7:
              rotate = -90;
              flipX = true;
              [width, height] = [height, width];
              break;
            case 8:
              rotate = -90;
              [width, height] = [height, width];
              break;
          }

          canvas.width = width;
          canvas.height = height;

          ctx.translate(width / 2, height / 2);
          if (rotate !== 0) {
            ctx.rotate((rotate * Math.PI) / 180);
          }
          if (flipX) {
            ctx.scale(-1, 1);
          }
          if (flipY) {
            ctx.scale(1, -1);
          }
          ctx.drawImage(img, -img.width / 2, -img.height / 2);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const rotatedFile = new File([blob], file.name, {
                  type: file.type,
                  lastModified: Date.now(),
                });
                resolve(rotatedFile);
              } else {
                resolve(file);
              }
            },
            file.type,
            0.95
          );
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  /**
   * 파일 미리보기 생성 (회전 적용)
   */
  const createPreview = async (file: File): Promise<string> => {
    // EXIF Orientation 확인 및 회전
    const orientation = await getImageOrientation(file);
    const rotatedFile = await rotateImage(file, orientation);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(rotatedFile);
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
        // 회전된 파일이 있으면 회전된 파일 사용, 없으면 원본 파일 사용
        const fileToUpload = fileState.rotatedFile || fileState.file;
        const result = await uploadToCloudinary(fileToUpload, index);
        
        // 업로드 성공 상태로 변경
        setFiles((prev) =>
          prev.map((f) =>
            f.file === fileState.file
              ? { ...f, status: 'success' as const, result }
              : f
          )
        );

        // 전처리된 이미지 URL 확인용 로그
        if (result.processed_url) {
          console.log('[ReceiptUpload] 전처리된 이미지 URL:', {
            fileName: fileState.file.name,
            originalUrl: result.secure_url || result.webViewLink,
            processedUrl: result.processed_url,
          });
        }

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

      // 새 파일들에 대한 미리보기 생성 및 회전 처리
      const newFiles: FileUploadState[] = await Promise.all(
        validFiles.map(async (file) => {
          // EXIF Orientation 확인 및 회전
          const orientation = await getImageOrientation(file);
          const rotatedFile = await rotateImage(file, orientation);
          
          // 회전된 파일로 미리보기 생성
          const preview = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(rotatedFile);
          });
          
          return {
            file,
            rotatedFile: orientation !== 1 ? rotatedFile : undefined, // 회전이 필요했던 경우만 저장
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
          {files.length === 0 && (
            <div className="flex flex-col items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400 text-center max-w-sm">
              <p>• 영수증 전체가 나오게 찍어주세요.</p>
              <p>• 흔들리지 않게, 가까이, 빛 반사 없이</p>
              <p>• 접히거나 구겨진 부분이 보이지 않게 펴서 촬영해주세요.</p>
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="mt-2 rounded-full border border-gray-300 px-3 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:border-gray-500 hover:text-gray-900 dark:border-gray-600 dark:text-gray-200 dark:hover:border-gray-400"
            >
              촬영 방법 예시 보기
            </button>
            </div>
          )}
        </div>
      </div>

      {/* 완료하기 버튼 */}
      {isAllUploadsComplete && (
        <div className="pt-4">
          <button
            onClick={async () => {
              try {
                // 업로드 성공한 파일 정보를 Cloudinary 원본 형식으로 변환
                const successfulFiles = files
                  .filter((f) => f.status === 'success' && f.result)
                  .map((f) => {
                    const result = f.result!;
                    // Cloudinary 원본 응답 형식으로 변환
                    // 전처리된 URL이 있으면 우선 사용, 없으면 원본 URL 사용
                    const imageUrl = result.processed_url || result.secure_url || result.webViewLink || result.url || result.webContentLink || '';
                    return {
                      asset_id: result.asset_id || '',
                      public_id: result.public_id || result.fileId,
                      format: result.format || '',
                      version: result.version || 0,
                      resource_type: result.resource_type || 'image',
                      type: result.type || 'upload',
                      created_at: result.created_at || new Date().toISOString(),
                      bytes: result.bytes || 0,
                      width: result.width || 0,
                      height: result.height || 0,
                      asset_folder: result.asset_folder || invoiceName || undefined,
                      display_name: result.display_name || result.name || f.file.name,
                      url: result.url || result.webContentLink || '',
                      secure_url: imageUrl, // 전처리된 이미지 URL 우선 사용
                      processed_url: result.processed_url, // 전처리된 URL 정보 포함
                    };
                  });

                // 파일이 없으면 웹훅 호출하지 않음 (빈 body 방지)
                if (successfulFiles.length === 0) {
                  alert('업로드된 영수증이 없습니다. 영수증을 업로드한 후 다시 시도해주세요.');
                  return;
                }

                // 디버깅 로그
                console.log('[ReceiptUpload] Sending to webhook:', {
                  fileCount: successfulFiles.length,
                  files: successfulFiles,
                  invoiceName,
                  userName,
                  userEmail,
                });

                // Make.com 웹훅 호출 (파일 배열과 사용자 정보 포함)
                const webhookPayload = {
                  files: successfulFiles,
                  user: {
                    name: userName || '',
                    email: userEmail || '',
                    invoiceName: invoiceName || '',
                  },
                };

                const response = await fetch(MAKE_WEBHOOK_URL, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(webhookPayload),
                });

                if (!response.ok) {
                  const errorData = await response.json().catch(() => ({}));
                  throw new Error(
                    errorData.message || '웹훅 호출에 실패했습니다.'
                  );
                }

                // 성공 시 Toast 표시
              setShowToast(true);
              } catch (error) {
                console.error('완료 처리 중 오류:', error);
                alert(
                  error instanceof Error
                    ? error.message
                    : '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
                );
              }
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

      {/* 영수증 업로드 주의사항 팝업 */}
      {showWarningModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="receipt-warning-title"
        >
          <div className="relative w-full max-w-3xl max-h-[90vh] rounded-[8px] bg-white shadow-2xl dark:bg-gray-900 overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 z-10 px-4 pt-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowWarningModal(false)}
                className="absolute right-4 top-4 text-sm text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
                aria-label="주의사항 팝업 닫기"
              >
                ✕
              </button>
              <h2 id="receipt-warning-title" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 pr-8">
                영수증 업로드시 주의사항
              </h2>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* 세부 주의사항 */}
              <div className="space-y-2 sm:space-y-3">
                <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                  영수증을 정확하게 인식하기 위해 아래 사항을 확인해주세요:
                </p>
                <ul className="list-disc space-y-1 sm:space-y-2 pl-4 sm:pl-5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  <li>영수증 전체가 프레임 안에 나오도록 촬영해주세요.</li>
                  <li>흔들리지 않게, 가까이, 빛 반사 없이 촬영해주세요.</li>
                  <li>접히거나 구겨진 부분이 보이지 않게 펴서 촬영해주세요.</li>
                  <li>영수증이 선명하게 보이도록 조명을 확인해주세요.</li>
                  <li>배경이 단색일수록 인식률이 올라갑니다.</li>
                </ul>
              </div>

              {/* 2열 이미지 레이아웃 - 모바일에서도 2열 */}
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                {/* 왼쪽: 이렇게하면 안되요 */}
                <div className="space-y-1 sm:space-y-2">
                  <h3 className="text-xs sm:text-base font-semibold text-red-600 dark:text-red-400 text-center">
                    이렇게하면 안되요
                  </h3>
                  <div className="relative w-full aspect-[2/3] sm:aspect-[3/4] rounded-[6px] sm:rounded-[8px] bg-gray-100 border-2 border-red-300 dark:bg-gray-800 dark:border-red-700 overflow-hidden">
                    <Image
                      src="/receipt-bad-example.png"
                      alt="잘못된 영수증 촬영 예시"
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover"
                      onError={(e) => {
                        // 이미지가 없을 경우 placeholder 표시
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400 text-xs">이미지 준비 중</div>';
                        }
                      }}
                    />
                  </div>
                </div>

                {/* 오른쪽: 이렇게 해주세요 */}
                <div className="space-y-1 sm:space-y-2">
                  <h3 className="text-xs sm:text-base font-semibold text-green-600 dark:text-green-400 text-center">
                    이렇게 해주세요
                  </h3>
                  <div className="relative w-full aspect-[2/3] sm:aspect-[3/4] rounded-[6px] sm:rounded-[8px] bg-gray-100 border-2 border-green-300 dark:bg-gray-800 dark:border-green-700 overflow-hidden">
                    <Image
                      src="/receipt-good-example.png"
                      alt="올바른 영수증 촬영 예시"
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover"
                      onError={(e) => {
                        // 이미지가 없을 경우 placeholder 표시
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400 text-xs">이미지 준비 중</div>';
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 확인 버튼 */}
              <div className="flex justify-end pt-2 sm:pt-4">
                <button
                  type="button"
                  onClick={() => setShowWarningModal(false)}
                  className="rounded-[4px] bg-foreground px-4 sm:px-6 py-2 text-xs sm:text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
                >
                  확인했습니다
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 촬영 가이드 모달 */}
      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="receipt-guide-title"
        >
          <div className="relative w-full max-w-2xl rounded-[8px] bg-white p-6 shadow-2xl dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="absolute right-4 top-4 text-sm text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
              aria-label="촬영 가이드 닫기"
            >
              ✕
            </button>

            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="flex-1 space-y-2">
                <h3 id="receipt-guide-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  영수증 촬영 가이드
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  아래 예시처럼 촬영하면 AI가 쉽게 인식할 수 있어요.
                </p>
                <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700 dark:text-gray-200">
                  <li>영수증 전체가 프레임 안에 나오도록 촬영해주세요.</li>
                  <li>빛 반사가 없는 평평한 곳에 두고 수직으로 촬영하면 좋아요.</li>
                  <li>배경이 단색일수록 인식률이 올라갑니다.</li>
                  <li>가능하면 한 장씩 촬영하고, 여러 장은 개별 업로드 해주세요.</li>
                </ul>
              </div>

              <div className="flex flex-1 items-center justify-center rounded-[8px] bg-gray-100 p-3 dark:bg-gray-800">
                <div className="relative h-64 w-full">
                  <Image
                    src="/receipt-guide-example.jpg"
                    alt="영수증 촬영 예시"
                    fill
                    sizes="(max-width: 768px) 100vw, 40vw"
                    className="rounded-[6px] object-cover"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-[4px] border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-500 hover:text-gray-900 dark:border-gray-600 dark:text-gray-200 dark:hover:border-gray-400"
              >
                이해했어요
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

