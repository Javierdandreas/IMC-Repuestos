"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HiPlus, HiTrash, HiSearch, HiCollection, HiCheckCircle, HiChevronLeft, HiCurrencyDollar, HiIdentification } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useMetadata } from "@/context/MetadataContext";
import { KitComponenteSearch } from "@/modules/kits/types/kits";

interface KitItem {
    id_producto: number;
    codigo: string;
    descripcion: string;
    cantidad: number;
    stock: number;
    precio_costo: number;
    precio_ml: number;
    precio_mostrador: number;
    precio_mecanico: number;
}

interface Props {
    kitId?: string;
    initialData?: any;
}

export function KitForm({ kitId, initialData }: Props) {
    const router = useRouter();
    const meta = useMetadata();
    const [loading, setLoading] = useState(false);
    
    // Form fields
    const [nombre, setNombre] = useState(initialData?.nombre || "");
    const [codigoManual, setCodigoManual] = useState(initialData?.codigo_kit || "");
    const [descripcion, setDescripcion] = useState(initialData?.descripcion || "");
    const [idSubcategoria, setIdSubcategoria] = useState<number | "">(initialData?.id_subcategoria || "");
    const [items, setItems] = useState<KitItem[]>(() => {
        if (!initialData?.componentes) return [];
        return initialData.componentes.map((c: any) => ({
            id_producto: c.id_producto,
            codigo: c.cod_unico || c.codigo || "",
            descripcion: c.descripcion || "",
            cantidad: c.cantidad || 1,
            stock: c.stock_actual !== undefined ? c.stock_actual : (c.stock || 0),
            precio_costo: Number(c.precio_costo || 0),
            precio_ml: Number(c.precio_ml || 0),
            precio_mostrador: Number(c.precio_mostrador || 0),
            precio_mecanico: Number(c.precio_mecanico || 0),
        }));
    });

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<KitComponenteSearch[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Filter subcategories for Kits (Category ID 10)
    const kitSubcategories = useMemo(() => {
        return meta.subcategorias.filter(s => s.id_categoria === 10);
    }, [meta.subcategorias]);

    // Totals calculation
    const totals = useMemo(() => {
        return items.reduce((acc, item) => ({
            costo: acc.costo + (item.precio_costo * item.cantidad),
            ml: acc.ml + (item.precio_ml * item.cantidad),
            mostrador: acc.mostrador + (item.precio_mostrador * item.cantidad),
            mecanico: acc.mecanico + (item.precio_mecanico * item.cantidad),
        }), { costo: 0, ml: 0, mostrador: 0, mecanico: 0 });
    }, [items]);

    // Kit Stock Calculation
    const kitStock = useMemo(() => {
        if (items.length === 0) return 0;
        const stocks = items.map(i => {
            const s = Number(i.stock || 0);
            const q = Number(i.cantidad || 1);
            if (q <= 0) return 0;
            return Math.floor(s / q);
        });
        const res = Math.min(...stocks);
        return isNaN(res) ? 0 : res;
    }, [items]);

    // Automatic naming logic
    const generateAutoName = () => {
        if (items.length === 0) return;
        const autoName = items.map(i => `${i.codigo || "???"} X${i.cantidad}`).join(" ");
        setNombre(autoName.toUpperCase());
    };

    // Auto-generate name for NEW kits if empty
    useEffect(() => {
        if (!kitId && items.length > 0 && (nombre === "" || items.length === 1)) {
            const autoName = items.map(i => `${i.codigo || "???"} X${i.cantidad}`).join(" ");
            setNombre(autoName.toUpperCase());
        }
    }, [items, kitId]);

    // Handle Item Search
    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const fetchComponents = async () => {
            setIsSearching(true);
            try {
                const res = await fetch(`/api/kits/search-componentes?q=${searchQuery}`);
                const data = await res.json();
                setSearchResults(data);
            } catch (error) {
                console.error("Search error:", error);
            } finally {
                setIsSearching(false);
            }
        };

        const timer = setTimeout(fetchComponents, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const addItem = (comp: KitComponenteSearch) => {
        if (items.some(i => i.id_producto === comp.id)) {
            toast.error("El producto ya está en el kit");
            return;
        }

        setItems(prev => [...prev, {
            id_producto: comp.id,
            codigo: comp.cod_unico,
            descripcion: comp.descripcion,
            cantidad: 1,
            stock: comp.stock,
            precio_costo: Number(comp.precio_costo),
            precio_ml: Number(comp.precio_ml),
            precio_mostrador: Number(comp.precio_mostrador),
            precio_mecanico: Number(comp.precio_mecanico),
        }]);
        setSearchQuery("");
        setSearchResults([]);
    };

    const removeItem = (id: number) => {
        setItems(prev => prev.filter(i => i.id_producto !== id));
    };

    const updateQuantity = (id: number, qty: number) => {
        if (qty < 1) return;
        setItems(prev => prev.map(i => i.id_producto === id ? { ...i, cantidad: qty } : i));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (items.length === 0) {
            toast.error("El kit debe tener al menos un componente");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                nombre: nombre.toUpperCase(),
                codigo_kit: codigoManual.toUpperCase(),
                descripcion: descripcion.toUpperCase(),
                id_subcategoria: idSubcategoria || null,
                componentes: items.map(i => ({
                    id_producto: i.id_producto,
                    cantidad: i.cantidad
                }))
            };

            const res = await fetch(kitId ? `/api/kits/${kitId}` : "/api/kits", {
                method: kitId ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Error al procesar el kit");
            }

            toast.success(kitId ? "Kit actualizado correctamente" : "Kit creado correctamente");
            router.push("/kits");
            router.refresh();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="max-w-6xl mx-auto flex flex-col gap-8 pb-20">
            {/* Header Sticky */}
            <div className="sticky top-0 z-20 flex flex-col md:flex-row md:items-center justify-between gap-4 py-6 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4">
                    <button 
                        type="button"
                        onClick={() => router.back()}
                        className="p-3 bg-slate-100 dark:bg-slate-900 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        <HiChevronLeft className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                            {kitId ? "Editar Kit" : "Crear Nuevo Kit Manual"}
                        </h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configuración de agrupación y componentes</p>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-500/20 active:scale-95 uppercase text-sm"
                >
                    {loading ? "PROCESANDO..." : kitId ? "GUARDAR CAMBIOS" : "FINALIZAR KIT"}
                    <HiCheckCircle className="h-5 w-5" />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Info */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <section className="bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="h-8 w-1 bg-indigo-600 rounded-full" />
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Info Principal</h2>
                        </div>

                        <div className="flex flex-col gap-5 text-left">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Código Individual del Kit</label>
                                <div className="relative">
                                    <HiIdentification className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                                    <input
                                        required
                                        value={codigoManual}
                                        onChange={e => setCodigoManual(e.target.value)}
                                        placeholder="EJ: KIT-REPA-001"
                                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold uppercase focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-300"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nombre del Combo</label>
                                    {items.length > 0 && (
                                        <button 
                                            type="button"
                                            onClick={generateAutoName}
                                            className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase hover:underline"
                                        >
                                            Generar desde componentes
                                        </button>
                                    )}
                                </div>
                                <input
                                    required
                                    value={nombre}
                                    onChange={e => setNombre(e.target.value)}
                                    placeholder="NOMBRE DESCRIPTIVO..."
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold uppercase focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subcategoría</label>
                                <select
                                    value={idSubcategoria}
                                    onChange={e => setIdSubcategoria(e.target.value ? Number(e.target.value) : "")}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                >
                                    <option value="">SIN SUBCATEGORÍA</option>
                                    {kitSubcategories.map(s => (
                                        <option key={s.id} value={s.id}>{s.descripcion.toUpperCase()}</option>
                                    ))}

                                </select>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nota / Observación</label>
                                <textarea
                                    value={descripcion}
                                    onChange={e => setDescripcion(e.target.value)}
                                    rows={3}
                                    placeholder="DETALLES ADICIONALES DEL KIT..."
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold uppercase focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none"
                                />
                            </div>
                        </div>
                    </section>

                </div>

                {/* Right Column: Components Selection */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <section className="bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-1 bg-indigo-600 rounded-full" />
                                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest text-left">Buscador de Componentes</h2>
                            </div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                                * Búsqueda solo por código único
                            </div>
                        </div>

                        <div className="relative group">
                            <HiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-6 w-6 transition-colors group-focus-within:text-indigo-500" />
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value.toUpperCase())}
                                placeholder="ESCRIBÍ EL CÓDIGO DEL PRODUCTO..."
                                className="w-full pl-14 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-300 uppercase tracking-wider"
                            />
                            
                            {/* Search Results Overlay */}
                            <AnimatePresence>
                                {searchResults.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-[400px] overflow-y-auto"
                                    >
                                        {searchResults.map(comp => (
                                            <button
                                                type="button"
                                                key={comp.id}
                                                onClick={() => addItem(comp)}
                                                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 group text-left"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-xl text-indigo-600 dark:text-indigo-400 font-mono text-xs font-black">
                                                        {comp.cod_unico}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-900 dark:text-white uppercase line-clamp-1">{comp.descripcion}</span>
                                                        <span className="text-[10px] text-slate-400">Stock actual: {comp.stock} un.</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-black text-emerald-500">$ {Number(comp.precio_ml).toLocaleString()} (ML)</span>
                                                    <HiPlus className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                                </div>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Components Table */}
                        <div className="mt-8">
                            <div className="flex items-center gap-2 mb-4">
                                <HiCollection className="h-5 w-5 text-slate-400" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Lista de Items ({items.length})</span>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800">
                                <table className="w-full border-collapse">
                                    <thead className="bg-slate-50 dark:bg-slate-800/30">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Item</th>
                                            <th className="px-4 py-3 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest w-32">Cant.</th>
                                            <th className="px-4 py-3 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">Precio (ML)</th>
                                            <th className="px-4 py-3 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                        <AnimatePresence initial={false}>
                                            {items.map((item) => (
                                                <motion.tr
                                                    layout
                                                    key={item.id_producto}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 20 }}
                                                    className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all text-left"
                                                >
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md font-mono">
                                                                {item.codigo || "S/C"}
                                                            </span>
                                                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                Stock: {item.stock ?? 0}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 mx-auto">
                                                            <button
                                                                type="button"
                                                                onClick={() => updateQuantity(item.id_producto, item.cantidad - 1)}
                                                                className="h-7 w-7 flex items-center justify-center bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg shadow-sm hover:bg-indigo-600 hover:text-white transition-all font-black"
                                                            >
                                                                -
                                                            </button>
                                                            <input
                                                                type="number"
                                                                value={item.cantidad}
                                                                onChange={e => updateQuantity(item.id_producto, Number(e.target.value))}
                                                                className="w-10 text-center bg-transparent text-sm font-black outline-none border-0"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => updateQuantity(item.id_producto, item.cantidad + 1)}
                                                                className="h-7 w-7 flex items-center justify-center bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg shadow-sm hover:bg-indigo-600 hover:text-white transition-all font-black"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-slate-900 dark:text-white">
                                                                $ {(item.precio_ml * item.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                                                                $ {item.precio_ml.toLocaleString('es-AR')} c/u
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeItem(item.id_producto)}
                                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                                                        >
                                                            <HiTrash className="h-5 w-5" />
                                                        </button>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                        {items.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-20 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="h-12 w-12 rounded-full border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-200 dark:text-slate-800">
                                                            <HiPlus className="h-6 w-6" />
                                                        </div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Empezá buscando y agregando componentes</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </form>
    );
}
