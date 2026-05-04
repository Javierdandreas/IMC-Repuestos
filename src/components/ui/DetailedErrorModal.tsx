"use client";

import { HiExclamation, HiXCircle, HiDatabase, HiIdentification, HiHashtag } from "react-icons/hi";
import { Modal } from "./Modal";
import { motion, AnimatePresence } from "framer-motion";

export type AppErrorType = 'validation' | 'conflict' | 'foreign_key' | 'not_found' | 'server' | 'permission';

export interface AppErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

interface DetailedErrorModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  type?: AppErrorType;
  message?: string;
  details?: AppErrorDetail[];
}

export function DetailedErrorModal({
  open,
  onClose,
  title = "Error en la Operación",
  type = 'server',
  message,
  details = []
}: DetailedErrorModalProps) {

  const getIcon = () => {
    switch (type) {
      case 'validation': return <HiExclamation className="h-10 w-10 text-amber-500" />;
      case 'conflict': return <HiHashtag className="h-10 w-10 text-orange-500" />;
      case 'foreign_key': return <HiDatabase className="h-10 w-10 text-red-600" />;
      case 'permission': return <HiIdentification className="h-10 w-10 text-indigo-500" />;
      default: return <HiXCircle className="h-10 w-10 text-red-500" />;
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'validation': return 'Faltan Datos';
      case 'conflict': return 'Dato Duplicado';
      case 'foreign_key': return 'Restricción de Uso';
      case 'permission': return 'Sin Acceso';
      case 'not_found': return 'No Encontrado';
      default: return 'Error del Servidor';
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'validation': return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50';
      case 'conflict': return 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/50';
      case 'foreign_key': return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50';
      case 'permission': return 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/50';
      default: return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50';
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-md">
      <div className="flex flex-col gap-6 py-2">
        <div className={`flex items-center gap-4 p-5 rounded-3xl border ${getBgColor()} transition-colors`}>
          <div className="shrink-0">{getIcon()}</div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{getTypeLabel()}</span>
            <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
              {message || "Ocurrió un problema inesperado al procesar tu solicitud."}
            </p>
          </div>
        </div>

        {details.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Detalles detectados:</h4>
            <div className="space-y-2">
              {details.map((detail, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={i} 
                  className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                  <div className="flex flex-col">
                    {detail.field && (
                      <span className="text-[9px] font-black uppercase text-slate-500 mb-0.5">{detail.field}</span>
                    )}
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{detail.message}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2">
          <button 
            onClick={onClose}
            className="w-full h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs uppercase tracking-widest hover:opacity-90 transition active:scale-[0.98] shadow-xl"
          >
            Entendido
          </button>
        </div>
      </div>
    </Modal>
  );
}
