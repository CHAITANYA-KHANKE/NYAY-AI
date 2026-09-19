/**
 * The pdf-parse package root performs a debug-mode fs read that breaks
 * serverless bundles, so the app imports `pdf-parse/lib/pdf-parse.js`
 * directly (see brain/17_DECISIONS.md ADR-006). @types/pdf-parse only
 * declares the package root module, so the deep import is declared here.
 */
declare module 'pdf-parse/lib/pdf-parse.js' {
  export interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    text: string;
    version: string;
  }

  export interface PdfParseOptions {
    pagerender?: (pageData: unknown) => Promise<string> | string;
    max?: number;
    version?: string;
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: PdfParseOptions,
  ): Promise<PdfParseResult>;

  export default pdfParse;
}
