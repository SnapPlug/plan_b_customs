import { v2 as cloudinary } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Cloudinary 설정
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  invoiceName?: string; // 인보이스명 (구글 시트 저장용)
  userName?: string; // 사용자 이름 (구글 시트 저장용)
  userPhone?: string; // 사용자 전화번호 (구글 시트 저장용)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const invoiceName = formData.get("invoiceName") as string | null;
    const userName = formData.get("userName") as string | null;
    const userPhone = formData.get("userPhone") as string | null;
    const fileIndex = formData.get("fileIndex") as string | null;

    if (!file) {
      return NextResponse.json(
        { message: "업로드할 파일이 없습니다." },
        { status: 400 }
      );
    }

    // Cloudinary 설정 확인
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return NextResponse.json(
        { message: "Cloudinary 설정이 완료되지 않았습니다. .env.local 파일을 확인해주세요." },
        { status: 500 }
      );
    }

    // 파일을 버퍼로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Base64로 인코딩하여 Cloudinary에 업로드
    const base64File = buffer.toString("base64");
    const dataURI = `data:${file.type};base64,${base64File}`;

    // public_id 생성: receipts/[이름]_[날짜]_[index] 형식
    let publicId: string | undefined;
    
    if (invoiceName) {
      // invoiceName 형식: "이름_YYYYMMDD"
      // 인덱스가 있으면 추가, 없으면 타임스탬프 사용
      const index = fileIndex ? fileIndex : Date.now().toString();
      publicId = `receipts/${invoiceName}_${index}`;
    } else {
      // invoiceName이 없으면 기본 동작
      publicId = undefined;
    }

    console.log("[upload] Cloudinary 업로드 시작:", file.name, "인보이스:", invoiceName, "인덱스:", fileIndex);

    // Cloudinary에 업로드
    const uploadOptions: Record<string, any> = {
      resource_type: "auto", // 자동으로 이미지/비디오 감지
      // 메타데이터로 사용자 정보 저장 (Make.com에서 조회 가능)
      context: {
        invoice_name: invoiceName || "",
        user_name: userName || "",
        user_phone: userPhone || "",
      },
    };

    // asset_folder 설정 (Make.com에서 조회 가능)
    if (invoiceName) {
      uploadOptions.asset_folder = invoiceName;
    }

    if (publicId) {
      // 인보이스 이름이 있으면 public_id 직접 지정 (폴더 경로 포함)
      uploadOptions.public_id = publicId;
      uploadOptions.use_filename = false;
      uploadOptions.unique_filename = false;
      // folder 옵션은 public_id에 이미 경로가 포함되어 있으므로 제거
    } else {
      // 인보이스 이름이 없으면 기본 동작
      uploadOptions.folder = "receipts";
      uploadOptions.use_filename = true;
      uploadOptions.unique_filename = true;
    }

    const uploadResult = await cloudinary.uploader.upload(dataURI, uploadOptions);

    console.log("[upload] Cloudinary 업로드 성공:", uploadResult.public_id);
    console.log("[upload] 메타데이터:", { invoiceName, userName, userPhone });

    // 전처리된 이미지 URL 생성
    // Cloudinary URL 직접 생성 (sdk_semver 에러 방지)
    // 변환 파라미터는 쉼표로 구분하여 하나의 변환 문자열로 결합
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
    
    // Cloudinary 변환 파라미터 (무료 플랜 호환)
    // 회전은 클라이언트 측에서 처리하므로 서버 측에서는 회전하지 않음
    // c_auto: 이미지 내용 기반 자동 크롭
    // g_auto: 자동 중심 맞춤 (이미지의 주요 영역을 기준으로 크롭 영역 계산)
    // q_auto: 자동 품질 최적화
    // 쉼표로 구분된 단일 변환에 여러 옵션을 적용
    const transformations = 'c_auto,g_auto,q_auto';
    
    // public_id는 이미 형식이 포함되지 않은 상태
    // 한글 등 특수문자가 포함된 경우 URL 인코딩 필요
    // 단, 슬래시(/)는 경로 구분자이므로 인코딩하지 않음
    const uploadedPublicId = uploadResult.public_id
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');
    const format = uploadResult.format || 'jpg';
    
    // 전처리된 이미지 URL 생성 (public_id는 URL 인코딩, 슬래시는 유지)
    const processedUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${transformations}/${uploadedPublicId}.${format}`;

    // 전처리된 이미지 URL 로그 출력 (디버깅용)
    console.log("[upload] 전처리된 이미지 URL:", processedUrl);
    console.log("[upload] 원본 이미지 URL:", uploadResult.secure_url);
    console.log("[upload] 변환 파라미터:", transformations);

    // Cloudinary 원본 응답 형식에 맞게 반환
    return NextResponse.json(
      {
        // Cloudinary 원본 필드들
        asset_id: uploadResult.asset_id,
        public_id: uploadResult.public_id,
        format: uploadResult.format,
        version: uploadResult.version,
        resource_type: uploadResult.resource_type,
        type: uploadResult.type,
        created_at: uploadResult.created_at,
        bytes: uploadResult.bytes,
        width: uploadResult.width,
        height: uploadResult.height,
        asset_folder: uploadResult.asset_folder || invoiceName || undefined,
        display_name: uploadResult.display_name || uploadResult.original_filename || file.name,
        url: uploadResult.url,
        secure_url: uploadResult.secure_url,
        // 전처리된 이미지 URL
        processed_url: processedUrl,
        // 호환성을 위한 필드들
        fileId: uploadResult.public_id,
        name: uploadResult.original_filename || file.name,
        webViewLink: processedUrl, // 전처리된 이미지 사용
        webContentLink: processedUrl, // 전처리된 이미지 사용
        // 사용자 정보 및 인보이스명 포함 (구글 시트 저장용)
        invoiceName: invoiceName || undefined,
        userName: userName || undefined,
        userPhone: userPhone || undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[upload] Cloudinary 업로드 실패", error);

    let errorMessage = "파일 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.";

    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();

      if (errorMsg.includes("invalid") && errorMsg.includes("api")) {
        errorMessage = "Cloudinary API 설정이 잘못되었습니다. .env.local 파일의 CLOUDINARY 설정을 확인해주세요.";
      } else if (errorMsg.includes("unauthorized") || errorMsg.includes("401")) {
        errorMessage = "Cloudinary 인증에 실패했습니다. API 키와 시크릿을 확인해주세요.";
      } else {
        errorMessage = error.message || errorMessage;
      }
    }

    return NextResponse.json(
      {
        message: errorMessage,
        error: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.message : String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}
