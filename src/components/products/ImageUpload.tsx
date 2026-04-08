"use client";

import { useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { HiUpload, HiX, HiPhotograph } from "react-icons/hi";
import { toast } from "sonner";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

export function ImageUpload({ value, onChange, disabled }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const deleteImageFromStorage = async (url: string) => {
    try {
      const parts = url.split("/productos/");
      if (parts.length < 2) return;
      
      const path = parts[1];
      const { error } = await supabase.storage.from("productos").remove([path]);
      if (error) throw error;
      console.log("Imagen borrada del storage:", path);
    } catch (error) {
      console.error("Error al borrar imagen del storage:", error);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validaciones básicas
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona una imagen válida.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen debe ser menor a 2MB.");
      return;
    }

    try {
      setIsUploading(true);
      
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `product-images/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from("productos") // Bucket name
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("productos")
        .getPublicUrl(filePath);

      onChange(publicUrl);
      toast.success("Imagen subida con éxito.");

      // Si había una imagen anterior, borrarla del storage tras subir la nueva con éxito
      if (value) {
        await deleteImageFromStorage(value);
      }
    } catch (error: any) {
      toast.error("Error al subir imagen: " + (error.message || "Error desconocido"));
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = async () => {
    if (value) {
      await deleteImageFromStorage(value);
    }
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div 
        className={`relative flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed transition
          ${value ? "border-transparent bg-slate-100" : "border-slate-300 bg-slate-50"}
          ${!disabled && !value ? "hover:border-blue-400 hover:bg-blue-50/30" : ""}
          ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
        `}
        onClick={() => !disabled && !value && fileInputRef.current?.click()}
      >
        {value ? (
          <div className="relative h-full w-full p-4 overflow-hidden rounded-xl">
             {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={value} 
              alt="Producto" 
              className="mx-auto block max-h-[350px] rounded-xl object-contain shadow-md" 
            />
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeImage(); }}
                className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-700"
              >
                <HiX className="h-5 w-5" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center p-8 text-center">
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                <span className="text-sm font-medium text-slate-600">Subiendo...</span>
              </div>
            ) : (
              <>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <HiPhotograph className="h-6 w-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-slate-700">Toca para subir una foto</span>
                  <span className="text-xs text-slate-500">JPG, PNG o WEBP (Máx. 2MB)</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <input 
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
        disabled={disabled || isUploading}
      />
      
      {value && !disabled && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition"
        >
          <HiUpload className="h-4 w-4" />
          Cambiar imagen
        </button>
      )}
    </div>
  );
}
