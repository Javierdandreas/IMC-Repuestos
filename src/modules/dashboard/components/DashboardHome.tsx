"use client";

import {
    TrendingUp,
    Users,
    Package,
    AlertCircle,
    ArrowRight,
    Calendar,
    Layers,
    Zap
} from "lucide-react";
import Link from "next/link";

export function DashboardHome() {
    return (
        <div className="space-y-10 pb-20 px-4 lg:px-10 py-12">
            {/* Hero Welcome */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-1 bg-slate-100 text-slate-900 text-[10px] font-bold uppercase tracking-wider rounded-md border border-slate-200">
                            IMC V2.0
                        </span>
                        <span className="text-slate-300 text-[10px]">•</span>
                        <span className="text-slate-400 text-[10px] flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </div>
                    <h1 className="text-[32px] md:text-[42px] font-black text-slate-900 leading-tight tracking-tight">
                        Bienvenido al <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600">Portal de Gestión</span>
                    </h1>
                    <p className="mt-3 text-[16px] text-slate-500 max-w-xl leading-relaxed">
                        Monitoreá tus ventas, gestioná repuestos y controlá el stock desde un solo lugar con la máxima precisión.
                    </p>
                </div>
            </header>

            {/* Quick Stats Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard
                    title="Ventas del día"
                    value="$1.242.500"
                    trend="+12% vs ayer"
                    icon={TrendingUp}
                    color="emerald"
                />
                <KpiCard
                    title="Presupuestos"
                    value="42"
                    trend="8 pendientes"
                    icon={Zap}
                    color="amber"
                />
                <KpiCard
                    title="Stock Crítico"
                    value="15"
                    trend="Acción requerida"
                    icon={Package}
                    color="red"
                />
                <KpiCard
                    title="Clientes nuevos"
                    value="124"
                    trend="+4 esta semana"
                    icon={Users}
                    color="neutral"
                />
            </section>

            {/* Main Apps Layout */}
            <section className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                {/* Module Access */}
                <div className="xl:col-span-2 space-y-6">
                    <h2 className="text-[18px] font-bold text-slate-900 flex items-center gap-2">
                        Módulos Principales
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ModuleLink
                            title="Módulo de Ventas"
                            desc="Creación de presupuestos, seguimiento de estados y facturación rápida."
                            href="/presupuestos/nuevo"
                            icon={Zap}
                            color="slate"
                        />
                        <ModuleLink
                            title="Depósito y Stock"
                            desc="Control de inventario, ubicaciones y preparación de pedidos."
                            href="/items"
                            icon={Layers}
                            color="emerald"
                        />
                        <ModuleLink
                            title="Finanzas"
                            desc="Cuentas corrientes de clientes y proveedores, pagos y cobros."
                            href="#"
                            icon={TrendingUp}
                            color="neutral"
                        />
                        <ModuleLink
                            title="Auditoría"
                            desc="Reportes avanzados de rendimiento y control de usuarios."
                            href="#"
                            icon={AlertCircle}
                            color="slate"
                        />
                    </div>
                </div>

                {/* Sidebar / Info */}
                <div className="space-y-6">
                    <h2 className="text-[18px] font-bold text-slate-900">
                        Notificaciones Críticas
                    </h2>
                    <div className="bg-white border border-slate-100 rounded-[28px] overflow-hidden shadow-sm">
                        <div className="p-1">
                            <NotifItem title="Pedido con faltante" time="hace 5m" type="alert" />
                            <NotifItem title="Nueva venta confirmada" time="hace 12m" type="success" />
                            <NotifItem title="Stock mínimo alcanzado: Optica Ford" time="hace 1h" type="warning" />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

function KpiCard({ title, value, trend, icon: Icon, color }: any) {
    const colors: any = {
        emerald: {
            bg: "bg-emerald-50 text-emerald-600 border-emerald-100",
            glow: "shadow-[0_20px_50px_rgba(16,185,129,0.12)] border-t-emerald-500",
            accent: "text-emerald-500"
        },
        amber: {
            bg: "bg-amber-50 text-amber-600 border-amber-100",
            glow: "shadow-[0_20px_50px_rgba(245,158,11,0.12)] border-t-amber-500",
            accent: "text-amber-500"
        },
        red: {
            bg: "bg-red-50 text-red-600 border-red-100",
            glow: "shadow-[0_20px_50px_rgba(239,68,68,0.12)] border-t-red-500",
            accent: "text-red-500"
        },
        blue: {
            bg: "bg-blue-50 text-blue-600 border-blue-100",
            glow: "shadow-[0_20px_50px_rgba(59,130,246,0.12)] border-t-blue-500",
            accent: "text-blue-500"
        },
        slate: {
            bg: "bg-slate-50 text-slate-600 border-slate-100",
            glow: "shadow-[0_20px_50px_rgba(30,41,59,0.08)] border-t-slate-900",
            accent: "text-slate-900"
        },
        neutral: {
            bg: "bg-slate-50 text-slate-900 border-slate-200",
            glow: "shadow-[0_20px_50px_rgba(0,0,0,0.05)] border-t-slate-400",
            accent: "text-slate-500"
        },
    };

    const c = colors[color] || colors.slate;

    return (
        <div className={`group bg-white border border-slate-100 p-7 rounded-[32px] transition-all duration-500 hover:-translate-y-2 border-t-2 ${c.glow} relative overflow-hidden transform-gpu [backface-visibility:hidden]`}>
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
                <Icon className="h-24 w-24" />
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 border ${c.bg} group-hover:scale-110 transition-transform duration-500 transform-gpu`}>
                <Icon className="h-6 w-6" />
            </div>
            <div className="relative z-10">
                <h3 className="text-slate-400 text-[13px] font-bold mb-1 group-hover:text-slate-600 transition-colors uppercase tracking-widest">{title}</h3>
                <p className="text-[32px] font-black text-slate-900 tracking-tighter">{value}</p>
                <div className="flex items-center gap-1 mt-2">
                    <span className={`text-[12px] font-black ${c.accent}`}>{trend}</span>
                </div>
            </div>
        </div>
    );
}

function ModuleLink({ title, desc, href, icon: Icon, color }: any) {
    const variants: any = {
        blue: "hover:border-blue-200 hover:bg-blue-50/30 text-blue-600 shadow-blue-500/5",
        emerald: "hover:border-emerald-200 hover:bg-emerald-50/30 text-emerald-600 shadow-emerald-500/5",
        slate: "hover:border-slate-300 hover:bg-slate-50/50 text-slate-900 shadow-slate-500/5",
        neutral: "hover:border-slate-300 hover:bg-slate-50/50 text-slate-900 shadow-slate-500/5",
    };

    const v = variants[color] || variants.slate;

    return (
        <Link href={href} className="flex group h-full transform-gpu">
            <div className={`flex-1 bg-white border border-slate-100 p-8 rounded-[32px] transition-all duration-500 shadow-sm hover:shadow-2xl relative overflow-hidden flex flex-col transform-gpu [backface-visibility:hidden] ${v}`}>
                {/* Background decorative glow */}
                <div className={`absolute -bottom-10 -right-10 w-32 h-32 blur-[60px] opacity-0 group-hover:opacity-20 transition-opacity duration-700 bg-current transform-gpu`} />

                <div className="flex items-start justify-between mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-lg transition-all duration-500 group-hover:scale-110 transform-gpu">
                        <Icon className="h-6 w-6" />
                    </div>
                    <div className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 group-hover:bg-white group-hover:text-inherit group-hover:border-current transition-all transform-gpu">
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                </div>
                <h3 className="text-[18px] font-black text-slate-900 mb-2">{title}</h3>
                <p className="text-[14px] text-slate-500 leading-relaxed font-medium">{desc}</p>
            </div>
        </Link>
    );
}

function NotifItem({ title, time, type }: any) {
    const icons: any = {
        alert: <AlertCircle className="h-4 w-4 text-red-500" />,
        success: <Zap className="h-4 w-4 text-emerald-500" />,
        warning: <AlertCircle className="h-4 w-4 text-orange-500" />,
    };

    return (
        <div className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center">
                {icons[type]}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-800 truncate">{title}</p>
                <p className="text-[10px] text-slate-400">{time}</p>
            </div>
        </div>
    );
}
