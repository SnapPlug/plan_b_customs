/**
 * UserInfoForm Component
 * 
 * 사용자 구분을 위한 입력 폼입니다.
 * 별도의 회원가입 없이 단순히 사용자를 구분하기 위한 정보를 수집합니다.
 * 
 * @param onSubmit - 폼 제출 시 호출되는 콜백 함수 (이름/사엄자명 전달)
 * @param onCancel - 취소/뒤로가기 시 호출되는 콜백 함수
 */

'use client';

import { useState, FormEvent, ChangeEvent } from 'react';

export interface UserInfo {
  name: string;
  email: string; // 이메일 (필수)
  invoiceName: string; // "이름_YYYYMMDD" 형식의 인보이스 식별자
}

interface UserInfoFormProps {
  /** 폼 제출 시 호출되는 콜백 함수 */
  onSubmit: (userInfo: UserInfo) => void;
  /** 취소/뒤로가기 시 호출되는 콜백 함수 */
  onCancel: () => void;
}

export default function UserInfoForm({ onSubmit, onCancel }: UserInfoFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);




  /**
   * 이름 변경 핸들러
   */
  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    // 실시간 에러 제거
    if (errors.name && value.trim()) {
      setErrors({ ...errors, name: undefined });
    }
  };

  /**
   * 이메일 변경 핸들러
   */
  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    // 실시간 에러 제거
    if (errors.email && value.trim()) {
      setErrors({ ...errors, email: undefined });
    }
  };

  

  /**
   * 폼 유효성 검사
   */
  const validate = (): boolean => {
    const newErrors: { name?: string; email?: string } = {};

    if (!name.trim()) {
      newErrors.name = '이름을 입력해주세요.';
    }

    // 이메일 필수 입력 및 유효성 검사
    if (!email.trim()) {
      newErrors.email = '이메일을 입력해주세요.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        newErrors.email = '올바른 이메일 형식을 입력해주세요.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * 폼 제출 핸들러
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    
    
    // 인보이스 이름 생성: "이름_YYYYMMDD" 형식
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    // 이름에서 특수문자 제거하고 언더스코어로 공백 대체 (Cloudinary 호환)
    const sanitizedName = name.trim().replace(/[^가-힣a-zA-Z0-9]/g, '_').replace(/\s+/g, '_');
    const invoiceName = `${sanitizedName}_${dateStr}`;
    
    // 약간의 딜레이로 제출 중 상태 표현
    await new Promise(resolve => setTimeout(resolve, 200));
    
    onSubmit({
      name: name.trim(),
      email: email.trim(), // 이메일 필수 입력
      invoiceName,
    });
    
    setIsSubmitting(false);
  };

  return (
    <div className="w-full max-w-md space-y-6 px-3">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
          사용자 정보 입력
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          영수증 처리를 위해 아래 정보를 입력해주세요.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 이름 입력 */}
        <div className="space-y-2">

          <input
            id="name"
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="홍길동/회사명"
            className={`
              w-full h-12 px-4 py-2
              rounded-[4px] border
              bg-white dark:bg-gray-900
              text-black dark:text-zinc-50
              placeholder-gray-400 dark:placeholder-gray-500
              transition-colors
              focus:outline-none focus:ring-2 focus:ring-offset-0
              ${
                errors.name
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-700 focus:border-gray-500 dark:focus:border-gray-500 focus:ring-gray-500'
              }
            `}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
          {errors.name && (
            <p
              id="name-error"
              className="text-sm text-red-500"
              role="alert"
            >
              {errors.name}
            </p>
          )}
        </div>

        {/* 이메일 입력 */}
        <div className="space-y-2">
          <input
            id="email"
            type="email"
            value={email}
            onChange={handleEmailChange}
            placeholder="example@email.com"
            className={`
              w-full h-12 px-4 py-2
              rounded-[4px] border
              bg-white dark:bg-gray-900
              text-black dark:text-zinc-50
              placeholder-gray-400 dark:placeholder-gray-500
              transition-colors
              focus:outline-none focus:ring-2 focus:ring-offset-0
              ${
                errors.email
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-700 focus:border-gray-500 dark:focus:border-gray-500 focus:ring-gray-500'
              }
            `}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email && (
            <p
              id="email-error"
              className="text-sm text-red-500"
              role="alert"
            >
              {errors.email}
            </p>
          )}
        </div>

        {/* 버튼 영역 */}
        <div className="flex flex-col gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`
              flex h-12 w-full items-center justify-center
              rounded-[4px] px-5
              text-base font-medium text-white
              transition-colors
              ${
                isSubmitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-foreground hover:bg-[#383838] dark:hover:bg-[#ccc]'
              }
            `}
          >
            {isSubmitting ? '처리 중...' : '다음'}
          </button>
        </div>
      </form>
    </div>
  );
}


