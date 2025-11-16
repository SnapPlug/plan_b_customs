/**
 * Make.com Webhook API Route
 * 
 * 완료하기 버튼 클릭 시 업로드된 영수증 정보를 Make.com 웹훅으로 전송합니다.
 */

import { NextRequest, NextResponse } from 'next/server';

const MAKE_WEBHOOK_URL = 'https://hook.eu2.make.com/fmv9cemu1lotfy2wns9ehp0rhm6dk5fd';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Cloudinary 원본 형식의 파일 배열을 Make.com 웹훅으로 전송
    // body는 이미 Cloudinary 형식의 파일 배열
    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(Array.isArray(body) ? body : []),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Make.com webhook error:', errorText);
      return NextResponse.json(
        { 
          message: 'Make.com 웹훅 호출에 실패했습니다.',
          error: errorText 
        },
        { status: response.status }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: '처리가 시작되었습니다.' 
    });
  } catch (error) {
    console.error('Make.com webhook error:', error);
    return NextResponse.json(
      { 
        message: '서버 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

