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
 * Cloudinary 업로드 완료 후 메타데이터 업데이트
 * 
 * 클라이언트에서 직접 업로드한 후, 메타데이터(context, asset_folder)를 업데이트합니다.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { publicId, invoiceName, userName, userPhone } = body;

    if (!publicId) {
      return NextResponse.json(
        { message: "public_id가 필요합니다." },
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

    // Context 업데이트 (add_context는 key=value|key2=value2 형태의 문자열을 요구)
    const contextData = {
      invoice_name: invoiceName || "",
      user_name: userName || "",
      user_phone: userPhone || "",
    };

    const contextEntries = Object.entries(contextData).filter(
      ([, value]) => typeof value === "string" && value.length > 0
    );

    if (contextEntries.length > 0) {
      const contextString = contextEntries
        .map(([key, value]) => `${key}=${value}`)
        .join("|");

      await cloudinary.uploader.add_context(contextString, [publicId]);
    }

    // Asset folder는 업로드 시 이미 설정되므로 별도 업데이트 불필요
    // 하지만 업로드 시 설정되지 않은 경우를 대비해 업데이트 시도
    if (invoiceName) {
      try {
        // asset_folder는 rename을 통해 변경할 수 없으므로, 
        // 업로드 시 이미 설정되어 있어야 합니다.
        // 여기서는 확인만 하고 업데이트는 하지 않습니다.
      } catch (error) {
        // asset_folder 업데이트 실패는 무시 (업로드 시 이미 설정됨)
        console.warn("[upload/metadata] asset_folder 업데이트 스킵:", error);
      }
    }

    console.log("[upload/metadata] 메타데이터 업데이트 성공:", publicId);

    return NextResponse.json({
      success: true,
      public_id: publicId,
    });
  } catch (error) {
    console.error("[upload/metadata] 메타데이터 업데이트 실패", error);

    return NextResponse.json(
      {
        message: "메타데이터 업데이트에 실패했습니다.",
        error: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.message : String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}

