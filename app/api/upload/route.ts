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

    // 파일 크기 확인
    const fileSizeMB = file.size / (1024 * 1024);
    console.log("[upload] 파일 정보:", {
      name: file.name,
      size: `${fileSizeMB.toFixed(2)}MB`,
      type: file.type,
    });

    // 참고: 이 엔드포인트는 이제 사용되지 않습니다 (클라이언트에서 직접 업로드).
    // 하지만 호환성을 위해 유지하며, 10MB 제한을 적용합니다.
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          message: `파일 크기가 너무 큽니다. 최대 ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB까지 업로드 가능합니다.`,
        },
        { status: 413 }
      );
    }

    // 파일을 버퍼로 변환 (Base64 인코딩 없이 직접 전달)
    // Cloudinary SDK는 Buffer를 직접 지원하므로 Base64 변환 불필요
    // 이렇게 하면 메모리 사용량과 페이로드 크기를 크게 줄일 수 있음
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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

    // Buffer를 직접 전달 (upload_stream 사용)
    // Cloudinary SDK는 스트림을 지원하므로 Buffer를 스트림으로 전달
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          ...uploadOptions,
          resource_type: uploadOptions.resource_type || "auto",
        },
        (error, result) => {
          if (error || !result) {
            return reject(error);
          }
          resolve(result);
        }
      );

      stream.end(buffer);
    });

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
      .map((segment: string) => encodeURIComponent(segment))
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
    let statusCode = 500;

    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();

      // 파일 크기 관련 에러
      if (errorMsg.includes("413") || errorMsg.includes("payload too large") || errorMsg.includes("request entity too large")) {
        errorMessage = "파일 크기가 너무 큽니다. 최대 10MB까지 업로드 가능합니다.";
        statusCode = 413;
      }
      // 타임아웃 관련 에러
      else if (errorMsg.includes("timeout") || errorMsg.includes("timed out") || errorMsg.includes("503")) {
        errorMessage = "업로드 시간이 초과되었습니다. 파일 크기를 줄이거나 잠시 후 다시 시도해주세요.";
        statusCode = 503;
      }
      // Cloudinary API 에러
      else if (errorMsg.includes("invalid") && errorMsg.includes("api")) {
        errorMessage = "Cloudinary API 설정이 잘못되었습니다. .env.local 파일의 CLOUDINARY 설정을 확인해주세요.";
        statusCode = 500;
      } else if (errorMsg.includes("unauthorized") || errorMsg.includes("401")) {
        errorMessage = "Cloudinary 인증에 실패했습니다. API 키와 시크릿을 확인해주세요.";
        statusCode = 401;
      } else {
        errorMessage = error.message || errorMessage;
      }
    }

    return NextResponse.json(
      {
        message: errorMessage,
        error: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.message : String(error)) : undefined,
      },
      { status: statusCode }
    );
  }
}
