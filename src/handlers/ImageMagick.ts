import {
  initializeImageMagick,
  ImageMagick,
  Magick,
  MagickFormat,
} from "@imagemagick/magick-wasm";

import mime from "mime";

import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";

class ImageMagickHandler implements FormatHandler {

  public name: string = "ImageMagick";

  public supportedFormats: FileFormat[] = [];

  public ready: boolean = false;

  async init () {

    const wasmLocation = "/node_modules/@imagemagick/magick-wasm/dist/magick.wasm";
    const wasmBytes = await fetch(wasmLocation).then(r => r.bytes());

    await initializeImageMagick(wasmBytes);

    Magick.supportedFormats.forEach(format => {
      const formatName = format.format.toLowerCase();
      const mimeType = format.mimeType || mime.getType(formatName);
      if (!mimeType || mimeType.startsWith("text/")) return;
      this.supportedFormats.push({
        name: format.description,
        format: formatName,
        extension: formatName,
        mime: mimeType,
        from: format.supportsReading,
        to: format.supportsWriting,
        internal: format.format
      });
    });

    // ====== Manual fine-tuning ======

    const prioritize = ["png", "jpeg", "apng", "gif", "pdf"];
    prioritize.reverse();

    this.supportedFormats.sort((a, b) => {
      const priorityIndexA = prioritize.indexOf(a.format);
      const priorityIndexB = prioritize.indexOf(b.format);
      return priorityIndexB - priorityIndexA;
    });

    this.ready = true;
  }

  async doConvert (
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {

    const inputMagickFormat = inputFormat.internal as MagickFormat;
    const outputMagickFormat = outputFormat.internal as MagickFormat;

    const outputFiles: FileData[] = [];

    for (const inputFile of inputFiles) {
      const baseName = inputFile.name.split(".")[0];
      const newName = baseName + "." + outputFormat.extension;

      ImageMagick.read(inputFile.bytes, inputMagickFormat, (image) => {
        image.write(outputMagickFormat, (bytes) => {
          outputFiles.push({ bytes: new Uint8Array(bytes), name: newName });
        });
        image.dispose();
      });
    }

    return outputFiles;

  }

}

export default ImageMagickHandler;
