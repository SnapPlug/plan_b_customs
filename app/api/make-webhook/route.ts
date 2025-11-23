/**
 * Make.com Webhook API Route
 * 
 * 완료하기 버튼 클릭 시 업로드된 영수증 정보를 Make.com 웹훅으로 전송합니다.
 */

import { NextRequest, NextResponse } from 'next/server';

const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/drbrltv2kk33ngrh1hf7dbfob2lfknbw';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 빈 body 또는 빈 배열 체크 (빈 요청 방지)
    if (!body || (Array.isArray(body) && body.length === 0)) {
      console.warn('[make-webhook] Empty body or empty array received, skipping webhook call');
      return NextResponse.json(
        { 
          message: '전송할 파일이 없습니다.',
          error: 'Empty body or empty array'
        },
        { status: 400 }
      );
    }

    // 배열이 아니거나 유효하지 않은 경우
    if (!Array.isArray(body)) {
      console.warn('[make-webhook] Invalid body format, expected array:', body);
      return NextResponse.json(
        { 
          message: '잘못된 데이터 형식입니다.',
          error: 'Expected array but received ' + typeof body
        },
        { status: 400 }
      );
    }

    // 디버깅 로그
    console.log('[make-webhook] Sending to Make.com:', {
      fileCount: body.length,
      firstFile: body[0] ? {
        public_id: body[0].public_id,
        secure_url: body[0].secure_url,
      } : null,
    });
    
    // Cloudinary 원본 형식의 파일 배열을 Make.com 웹훅으로 전송
    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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

