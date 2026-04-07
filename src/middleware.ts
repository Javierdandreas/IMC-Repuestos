import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { canManageContent, canReadContent } from "@/lib/permissions";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout", "/api/auth/me"];

const WRITE_PAGE_PREFIXES = [
  "/productos/new",
  "/productos/edit",
  "/marcas/new",
  "/marcas/edit",
  "/proveedores/new",
  "/proveedores/edit",
  "/categorias/new",
  "/categorias/edit",
  "/subcategorias/new",
  "/subcategorias/edit",
  "/piezas/new",
  "/piezas/edit",
];

function isAssetPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map)$/) !== null
  );
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isWritePage(pathname: string) {
  return WRITE_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isAssetPath(pathname)) {
    return NextResponse.next();
  }

  const { response, authUserId, usuarioId, rol, activo } = await updateSession(request);
  const hasReadAccess = Boolean(authUserId && usuarioId && activo && canReadContent(rol));

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && hasReadAccess) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return response;
  }

  if (!hasReadAccess) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isWritePage(pathname) && !canManageContent(rol)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

