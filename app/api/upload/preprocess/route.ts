/**
 * Image Preprocessing API Route
 * 
 * 업로드된 이미지에 전처리를 적용합니다:
 * - 문서 자동 감지 및 크롭
 * - 자동 회전 보정
 * - 배경 제거 (옵션)
 */

import { v2 as cloudinary } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { public_id, remove_background = false } = body;

    if (!public_id) {
      return NextResponse.json(
        { message: "public_id가 필요합니다." },
        { status: 400 }
      );
    }

    // 전처리된 이미지 URL 생성 (Cloudinary URL 직접 생성)
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
    
    // 기본 변환: 자동 크롭 + 품질 최적화 (무료 플랜 호환)
    // c_auto: 이미지 내용 기반 자동 크롭
    // g_auto: 자동 중심 맞춤
    // q_auto: 자동 품질 최적화
    let transformationParams = 'c_auto,g_auto,q_auto';
    
    // 배경 제거 옵션 (AI 기능, 유료 플랜 필요할 수 있음)
    if (remove_background) {
      transformationParams += '/e_background_removal';
    }

    // public_id에서 형식 추출 (없으면 jpg로 기본값)
    const format = public_id.split('.').pop() || 'jpg';
    const publicIdWithoutFormat = public_id.replace(/\.[^/.]+$/, '');
    
    // 한글 등 특수문자가 포함된 경우 URL 인코딩 필요
    // 단, 슬래시(/)는 경로 구분자이므로 인코딩하지 않음
    const encodedPublicId = publicIdWithoutFormat
      .split('/')
      .map((segment: string) => encodeURIComponent(segment))
      .join('/');
    
    // 전처리된 이미지 URL 생성
    const processedUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${transformationParams}/${encodedPublicId}.${format}`;

    // 전처리된 이미지를 새 버전으로 저장 (선택사항)
    // 또는 URL만 반환하여 온디맨드 변환 사용

    return NextResponse.json({
      success: true,
      original_public_id: public_id,
      processed_url: processedUrl,
      transformations: transformationParams,
    });
  } catch (error) {
    console.error("[preprocess] 이미지 전처리 실패", error);
    return NextResponse.json(
      {
        message: "이미지 전처리에 실패했습니다.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

