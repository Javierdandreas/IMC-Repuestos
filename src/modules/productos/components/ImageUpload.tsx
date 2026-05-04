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
  const supabase = createClient();

  const deleteImageFromStorage = useCallback(async (url: string) => {
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
  }, [bucket, supabase]);

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
  }, [bucket, folder, onChange, value, supabase, deleteImageFromStorage]);

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
    <div 
      ref={containerRef}
      className={`relative flex flex-col gap-4 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      {value ? (
        <div className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
          <Image
            src={value}
            alt="Uploaded image"
            fill
            className="object-contain p-4"
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute right-2 top-2 rounded-full bg-red-500 p-1.5 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-600 shadow-lg"
          >
            <HiX className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-all
            ${isDragging 
              ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20" 
              : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-900/30"
            }
          `}
        >
          <div className={`p-4 rounded-full ${isDragging ? "bg-blue-500 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
            <HiPhotograph className="h-8 w-8" />
          </div>
          <div className="text-center px-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
              {isUploading ? "Subiendo..." : "Click o soltá para subir"}
            </p>
            <p className="mt-1 text-[10px] font-bold text-slate-400">Podes pegar desde el portapapeles</p>
          </div>
        </div>
      )}
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}
