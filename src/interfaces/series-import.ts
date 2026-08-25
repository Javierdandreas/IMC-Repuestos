export type ImportSeriesMapping = {
  codigo_producto?: { csvHeader: string };
  serie?: { csvHeader: string };
  ubicacion?: { csvHeader: string };
  estado?: { csvHeader: string };
};

export type ImportSeriesError = {
  row: number;
  codigo_producto: string;
  serie: string;
  error: string;
};

export type ImportSeriesResult = {
  created: number;
  updated: number;
  ignored: number;
  errors: ImportSeriesError[];
  durationMs: number;
};
