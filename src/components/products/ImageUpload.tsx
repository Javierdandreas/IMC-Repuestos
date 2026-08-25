"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { HiUpload, HiX, HiPhotograph } from "react-icons/hi";
import Image from "next/image";
import { toast } from "sonner";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  bucket?: string;
  folder?: string;
}

export function ImageUpload({ 
  value, 
  onChange, 
  disabled, 
  bucket = "productos",
  folder = "product-images"
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = createClient();

  const processFile = useCallback(async (file: File) => {
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
      
      const fileExt = file.name ? file.name.split(".").pop() : "png";
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      onChange(publicUrl);
      toast.success("Imagen subida con éxito.");

      if (value) {
        await deleteImageFromStorage(value);
      }
    } catch (error: any) {
      toast.error("Error al subir imagen: " + (error.message || "Error desconocido"));
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  }, [bucket, folder, onChange, value, supabase]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (disabled || value || isUploading) return;
    
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processFile(file);
          break;
        }
      }
    }
  }, [disabled, value, isUploading, processFile]);

  const handleDragOver = (e: React.DragEvent) => {
    if (disabled || value || isUploading) return;
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (disabled || value || isUploading) return;
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;

    const pasteHandler = (e: Event) => handlePaste(e as ClipboardEvent);
    target.addEventListener("paste", pasteHandler);
    
    return () => {
      target.removeEventListener("paste", pasteHandler);
    };
  }, [handlePaste]);

  const deleteImageFromStorage = async (url: string) => {
    try {
      const parts = url.split(`/${bucket}/`);
      if (parts.length < 2) return;
      
      const path = parts[1];
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) throw error;
      console.log(`Imagen borrada del storage (${bucket}):`, path);
    } catch (error) {
      console.error("Error al borrar imagen del storage:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
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
    <div className="flex flex-col gap-4" ref={containerRef}>
      <div 
        className={`relative flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed transition outline-none
          ${value ? "border-transparent bg-slate-100" : "border-slate-300 bg-slate-50"}
          ${isDragging ? "border-blue-500 bg-blue-50/50 ring-4 ring-blue-50" : ""}
          ${!disabled && !value && !isDragging ? "hover:border-blue-400 hover:bg-blue-50/30" : ""}
          ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
        `}
        onClick={() => !disabled && !value && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        tabIndex={disabled || value ? -1 : 0}
      >
        {value ? (
          <div className="relative h-full w-full p-4 overflow-hidden rounded-xl">
            <div className="relative mx-auto block h-[350px] w-full max-w-full rounded-xl overflow-hidden shadow-md">
              <Image 
                src={value} 
                alt="Item" 
                fill
                className="object-contain" 
                unoptimized
              />
            </div>
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
                <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-200 ${isDragging ? "scale-110 bg-blue-600 text-white" : "bg-blue-100 text-blue-600"}`}>
                  <HiPhotograph className="h-6 w-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-slate-700">
                    {isDragging ? "¡Soltala acá!" : "Toca, arrastrá o pegá una foto"}
                  </span>
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
