import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";

class txtToHraHandler implements FormatHandler {
  public name: string = "txtToHra";

  public supportedFormats: FileFormat[] = [
    {
      name: "Plain Text",
      format: "txt",
      extension: "txt",
      mime: "text/plain",
      from: false,
      to: false,
      internal: "txt"
    },
    {
      name: "Human Readable Archive",
      format: "hra",
      extension: "hra",
      mime: "archive/x-hra",
      from: false,
      to: true,
      internal: "hra"
    }
  ];

  public ready: boolean = true;

  async init() {
    this.ready = true;
  }

  // Debug-safe doConvert: logs entry/exit, normalizes bytes, validates size, and re-throws errors.
  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {
    console.log('[txtToHra] doConvert START', {
      inputFilesLength: inputFiles?.length,
      inputInternal: inputFormat?.internal,
      outputInternal: outputFormat?.internal
    });

    if (inputFormat.internal !== "txt" || outputFormat.internal !== "hra") {
      throw new Error("Unsupported format conversion for txt2hra handler.");
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB guard for debugging

    const out: FileData[] = [];

    for (let i = 0; i < inputFiles.length; i++) {
      const file = inputFiles[i];
      try {
        console.log(`[txtToHra] converting file[${i}] name=${file.name} bytesType=${typeof file.bytes}`);

        // Normalize bytes to Uint8Array - robust runtime checks without `instanceof` on typed types
        let bytes: Uint8Array;

        if (ArrayBuffer.isView(file.bytes)) {
          // TypedArray or DataView
          const view = file.bytes as ArrayBufferView;
          const buffer = (view as any).buffer as ArrayBuffer;
          const byteOffset = (view as any).byteOffset || 0;
          const byteLength = (view as any).byteLength || (view as any).length || (buffer ? buffer.byteLength - byteOffset : 0);
          bytes = new Uint8Array(buffer, byteOffset, byteLength);
        } else if (file.bytes instanceof ArrayBuffer) {
          bytes = new Uint8Array(file.bytes);
        } else if (typeof file.bytes === "string") {
          bytes = new TextEncoder().encode(file.bytes);
        } else if (file.bytes && typeof (file.bytes as any).length === "number") {
          // array-like (number[])
          bytes = new Uint8Array(file.bytes as any);
        } else {
          throw new Error(`Unsupported file.bytes type for ${file.name}`);
        }

        console.log(`[txtToHra] file[${i}] bytes.length=${bytes.length}`);
        if (bytes.length > MAX_BYTES) {
          throw new Error(`Input too large: ${bytes.length} bytes (max ${MAX_BYTES})`);
        }

        const txt = decoder.decode(bytes);

        // Minimal transformation for HRA debug output
        const script = `<~= HRA File =~>\n<= File => ${file.name}\n${txt}'@`;
        const newName = file.name.replace(/\.[^.]+$/, "." + outputFormat.extension);

        const outBytes = encoder.encode(script);
        console.log(`[txtToHra] file[${i}] produced outBytes.length=${outBytes.length}`);

        out.push({ name: newName, bytes: outBytes } as FileData);
      } catch (err) {
        console.error(`[txtToHra] file[${i}] conversion error:`, err);
        throw err; // surface error to caller so conversion pipeline can handle it
      }
    }

    console.log('[txtToHra] doConvert END, out.length=', out.length);
    return out;
  }
}

export default txtToHraHandler;
