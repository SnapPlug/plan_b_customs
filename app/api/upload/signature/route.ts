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

/**
 * Cloudinary 업로드 서명 생성
 * 
 * 클라이언트에서 직접 Cloudinary로 업로드할 수 있도록 서명을 생성합니다.
 * 이렇게 하면 Vercel의 4.5MB 페이로드 제한을 우회할 수 있습니다.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoiceName, userName, userPhone, fileIndex, publicId } = body;

    // Cloudinary 설정 확인
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return NextResponse.json(
        { message: "Cloudinary 설정이 완료되지 않았습니다. .env.local 파일을 확인해주세요." },
        { status: 500 }
      );
    }

    // public_id 생성: receipts/[이름]_[날짜]_[index] 형식
    let finalPublicId: string | undefined;
    
    if (invoiceName) {
      const index = fileIndex ? fileIndex : Date.now().toString();
      finalPublicId = `receipts/${invoiceName}_${index}`;
    } else if (publicId) {
      finalPublicId = publicId;
    }

    // 업로드 파라미터 구성
    // Cloudinary 서명 생성 시 파라미터는 실제 업로드 시 전송하는 것과 정확히 일치해야 함
    // 참고: context는 서명에 포함하지 않고, 업로드 후 메타데이터로 설정하는 것이 더 안전함
    // 참고2: Cloudinary는 signature 생성 시 file, cloud_name, resource_type, api_key, signature는 제외
    const params: Record<string, any> = {};

    // asset_folder 설정
    if (invoiceName) {
      params.asset_folder = invoiceName;
    }

    // public_id 또는 folder 설정
    if (finalPublicId) {
      params.public_id = finalPublicId;
    } else {
      params.folder = "receipts";
    }
    
    // Context 데이터는 나중에 메타데이터 업데이트로 설정
    // 서명 생성 시에는 포함하지 않음 (서명 복잡도 감소 및 오류 방지)

    // 서명 생성
    // Cloudinary는 파라미터를 알파벳 순으로 정렬하여 서명을 생성하므로,
    // 서명 생성 시 사용하는 파라미터와 실제 업로드 시 전송하는 파라미터가 정확히 일치해야 함
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // 서명에 포함될 파라미터만 구성 (file, api_key, signature, resource_type는 서명에 포함되지 않음)
    const signatureParams: Record<string, string> = {};
    
    // 모든 파라미터를 문자열로 변환하여 서명 생성
    // Cloudinary는 파라미터를 문자열로 변환하고 정렬한 후 서명을 생성함
    if (params.public_id) {
      signatureParams.public_id = String(params.public_id);
    }
    if (params.folder) {
      signatureParams.folder = String(params.folder);
    }
    if (params.context) {
      signatureParams.context = String(params.context);
    }
    if (params.asset_folder) {
      signatureParams.asset_folder = String(params.asset_folder);
    }
    signatureParams.timestamp = String(timestamp);
    
    const sortedKeys = Object.keys(signatureParams).sort();
    const stringToSign = sortedKeys
      .map((key) => `${key}=${signatureParams[key]}`)
      .join("&");

    console.log("[upload/signature] 서명 생성 파라미터:", JSON.stringify(signatureParams, null, 2));
    console.log("[upload/signature] string_to_sign:", stringToSign);
    
    const signature = cloudinary.utils.api_sign_request(
      signatureParams,
      process.env.CLOUDINARY_API_SECRET!
    );

    console.log("[upload/signature] 서명 생성 완료:", signature);

    return NextResponse.json({
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      params,
      stringToSign,
    });
  } catch (error) {
    console.error("[upload/signature] 서명 생성 실패", error);

    return NextResponse.json(
      {
        message: "서명 생성에 실패했습니다.",
        error: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.message : String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}

