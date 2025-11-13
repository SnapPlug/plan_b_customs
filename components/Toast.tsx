'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  duration?: number;
  onClose?: () => void;
}

/**
 * Toast 컴포넌트
 * 
 * 사용자에게 일시적인 알림 메시지를 표시하는 컴포넌트입니다.
 * 지정된 시간 후 자동으로 사라집니다.
 * 
 * @param message - 표시할 메시지
 * @param duration - 표시 시간 (밀리초, 기본값: 2000ms)
 * @param onClose - 토스트가 닫힐 때 호출되는 콜백 함수
 */
export default function Toast({ message, duration = 2000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      // 애니메이션 완료 후 onClose 호출
      setTimeout(() => {
        if (onClose) {
          onClose();
        }
      }, 300); // fade-out 애니메이션 시간
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`
        fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50
        px-6 py-4 rounded-[4px] shadow-lg
        bg-gray-900 dark:bg-gray-800 text-white text-sm font-medium
        transition-all duration-300 ease-in-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
      role="alert"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

