declare module "xlsx/dist/cpexcel.full.mjs" {
  export const cptable: Record<number, unknown>;
  export const utils: {
    decode: (codepage: number, data: number[] | Uint8Array | string) => string;
    encode: (codepage: number, value: string) => number[];
    hascp: (codepage: number) => boolean;
  };
}

declare module "xlsx/dist/xlsx.full.min.js" {
  export * from "xlsx";
}
