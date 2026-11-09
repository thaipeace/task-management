import { NextResponse, type NextRequest } from "next/server";

// Kiểm tra lạc quan: chưa có cookie phiên thì đưa về trang đăng nhập.
// Quyền thật được kiểm lại ở từng trang / server action.
// /api/v1 tự xác thực bằng Bearer token, không dùng cookie
const PUBLIC = ["/login", "/setup", "/invite/", "/forgot-password", "/reset-password/", "/api/v1/"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();
  if (!request.cookies.has("tm_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
