import Link from 'next/link';

/**
 * 404 Not Found 페이지
 * 
 * 존재하지 않는 경로에 접근했을 때 표시되는 페이지입니다.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center justify-center gap-6 text-center px-4">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-zinc-50">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300">
          페이지를 찾을 수 없습니다
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
        </p>
        <Link
          href="/"
          className="mt-4 px-6 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-[4px] transition-colors"
        >
          홈으로 돌아가기
        </Link>
      </main>
    </div>
  );
}

