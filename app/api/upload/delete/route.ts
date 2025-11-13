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
 * Cloudinary에서 이미지 삭제
 * @param req - NextRequest 객체 (public_id를 body에서 받음)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { public_id } = body;

    if (!public_id || typeof public_id !== "string") {
      return NextResponse.json(
        { message: "public_id가 필요합니다." },
        { status: 400 }
      );
    }

    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return NextResponse.json(
        {
          message:
            "Cloudinary 설정이 완료되지 않았습니다. .env.local 파일을 확인해주세요.",
        },
        { status: 500 }
      );
    }

    console.log("[delete] Cloudinary 삭제 시작:", public_id);

    // Cloudinary에서 이미지 삭제
    const deleteResult = await cloudinary.uploader.destroy(public_id, {
      resource_type: "image",
    });

    console.log("[delete] Cloudinary 삭제 결과:", deleteResult);

    if (deleteResult.result === "ok" || deleteResult.result === "not found") {
      // "not found"도 성공으로 처리 (이미 삭제된 경우)
      return NextResponse.json(
        {
          success: true,
          message: "이미지가 삭제되었습니다.",
          result: deleteResult.result,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "이미지 삭제에 실패했습니다.",
          result: deleteResult.result,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[delete] Cloudinary 삭제 실패", error);

    let errorMessage = "이미지 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.";

    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();

      if (errorMsg.includes("invalid") && errorMsg.includes("api")) {
        errorMessage =
          "Cloudinary API 설정이 잘못되었습니다. .env.local 파일의 CLOUDINARY 설정을 확인해주세요.";
      } else if (errorMsg.includes("unauthorized") || errorMsg.includes("401")) {
        errorMessage =
          "Cloudinary 인증에 실패했습니다. API 키와 시크릿을 확인해주세요.";
      } else {
        errorMessage = error.message || errorMessage;
      }
    }

    return NextResponse.json(
      {
        message: errorMessage,
        error:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 500 }
    );
  }
}

