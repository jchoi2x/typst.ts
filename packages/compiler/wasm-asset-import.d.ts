/**
 * Default export when importing the `.wasm` binary from JS (bundlers, Workers, etc.).
 * Aligns with `WebAssemblyModuleRef` in `@jchoi2x/typst.ts` (`init` / `getModule`).
 */
declare const wasmModule: WebAssembly.Module | ArrayBuffer | Uint8Array | string | URL | Response;
export default wasmModule;
