import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { permisoParaApi, permisoParaPagina, puedeAccederPermisos, tienePermisoDeLectura } from "@/lib/permissions";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout", "/api/auth/me"];

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

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isAssetPath(pathname)) {
    return NextResponse.next();
  }

  // Los cron validan su propio Bearer token y el webhook valida la aplicacion de Mercado Libre.
  // Ninguno puede depender de una sesion de usuario del navegador.
  if (
    pathname === "/api/cron/catalogo-externo" ||
    pathname === "/api/cron/mercadolibre" ||
    pathname === "/api/cron/multimoneda" ||
    pathname === "/api/integraciones/mercadolibre/notificaciones"
  ) {
    return NextResponse.next();
  }

  const { response, authUserId, usuarioId, rol, activo, permisos } = await updateSession(request);
  const hasReadAccess = Boolean(authUserId && usuarioId && activo && tienePermisoDeLectura(rol, permisos));

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

  if (rol === "admin") return response;
  if (pathname === "/sin-permisos") return response;

  const requisito = pathname.startsWith("/api/")
    ? permisoParaApi(pathname, request.method, request.nextUrl.searchParams)
    : permisoParaPagina(pathname, request.nextUrl.searchParams);

  if (!requisito || !puedeAccederPermisos(rol, permisos, requisito)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "No tienes permiso para esta accion." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/sin-permisos", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.ico).*)"],
};

