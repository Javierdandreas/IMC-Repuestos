declare module "xlsx/dist/cpexcel.full.mjs" {
  export const cptable: {
    utils: {
      decode: (codepage: number, data: number[] | Uint8Array | string) => string;
      encode: (codepage: number, value: string) => number[];
      hascp: (codepage: number) => boolean;
    };
  };
}
