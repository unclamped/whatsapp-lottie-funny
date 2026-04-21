import fs from "fs-extra";
import path from "path";
import os from "os";
import crypto from "crypto";
import sharp from "sharp";
import yazl from "yazl";

/**
 * Builds a WhatsApp Lottie Sticker (.was)
 */
export async function buildWasSticker({ imagePath, outputPath, templatePath, metadata = {}, animation = "spin" }) {
  if (!fs.existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`);
  if (!fs.existsSync(templatePath)) throw new Error(`Template not found: ${templatePath}`);

  const tempDir = path.join(os.tmpdir(), `was-build-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`);
  
  try {
    await fs.ensureDir(tempDir);
    await fs.copy(templatePath, tempDir);

    const jsonPath = path.join(tempDir, "animation", "animation_secondary.json");
    if (!fs.existsSync(jsonPath)) {
      throw new Error("Invalid template: animation_secondary.json not found");
    }

    const lottieJson = await fs.readJson(jsonPath);
    
    // Animation Presets
    const layers = (lottieJson.layers || []).filter(l => l.ty === 2 && typeof l.refId === "string");

    if (animation === "expand") {
        for (const layer of layers) {
            if (layer.ks?.r) {
                layer.ks.r.a = 1;
                layer.ks.r.k = [{ t: 0, s: [0], e: [0] }, { t: 240 }];
            }
            if (layer.ks?.o) {
                layer.ks.o.a = 1;
                layer.ks.o.k = [{ t: 0, s: [0], e: [100] }, { t: 16, s: [100], e: [100] }, { t: 240 }];
            }
            if (layer.ks?.s) {
                layer.ks.s.a = 1;
                layer.ks.s.k = [
                    { t: 0, s: [30, 30, 100], e: [125, 125, 100] },
                    { t: 36, s: [125, 125, 100], e: [100, 100, 100] },
                    { t: 72, s: [100, 100, 100], e: [104, 104, 100] },
                    { t: 132, s: [104, 104, 100], e: [100, 100, 100] },
                    { t: 192, s: [100, 100, 100], e: [102, 102, 100] },
                    { t: 240, s: [102, 102, 100] }
                ];
            }
        }
    } else if (animation === "spin") {
        for (const layer of layers) {
            if (layer.ks?.r) {
                layer.ks.r.a = 1;
                layer.ks.r.k = [{ t: 0, s: [0], e: [360] }, { t: 240 }];
            }
        }
    } else if (animation === "jumpscare") {
        for (const layer of layers) {
            // Stay hidden for most of the time
            if (layer.ks?.o) {
                layer.ks.o.a = 1;
                layer.ks.o.k = [
                    { t: 0, s: [0], e: [0] },
                    { t: 180, s: [0], e: [100] }, // Pop in at frame 180
                    { t: 240 }
                ];
            }
            // Sudden scale up with shake
            if (layer.ks?.s) {
                layer.ks.s.a = 1;
                layer.ks.s.k = [
                    { t: 0, s: [0, 0, 100], e: [0, 0, 100] },
                    { t: 180, s: [0, 0, 100], e: [150, 150, 100] }, // Sudden jump
                    { t: 185, s: [150, 150, 100], e: [160, 160, 100] }, // Jitter
                    { t: 190, s: [160, 160, 100], e: [150, 150, 100] },
                    { t: 240 }
                ];
            }
            // Shake position
            if (layer.ks?.p) {
                layer.ks.p.a = 1;
                const px = layer.ks.p.k[0] || 0;
                const py = layer.ks.p.k[1] || 0;
                layer.ks.p.k = [
                    { t: 0, s: [px, py], e: [px, py] },
                    { t: 180, s: [px, py], e: [px + 5, py - 5] },
                    { t: 185, s: [px + 5, py - 5], e: [px - 5, py + 5] },
                    { t: 190, s: [px - 5, py + 5], e: [px, py] },
                    { t: 240 }
                ];
            }
        }
    }

    const asset = lottieJson.assets.find(a => a.p && a.p.startsWith("data:image/"));
    if (!asset) throw new Error("No embedded image asset found in template");

    const targetWidth = asset.w || 512;
    const targetHeight = asset.h || 512;

    const processedImage = await sharp(imagePath)
      .resize(targetWidth, targetHeight, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();

    asset.p = `data:image/png;base64,${processedImage.toString("base64")}`;
    await fs.writeJson(jsonPath, lottieJson);

    // Metadata
    const metaPath = path.join(tempDir, "animation", "animation.json.overridden_metadata");
    const metaObj = {
      "sticker-pack-id": metadata.packId || "funny-bot",
      "sticker-pack-name": metadata.packName || "Sticker Pack",
      "sticker-pack-publisher": metadata.publisher || "Bot",
      "accessibility-text": metadata.accessibilityText || "Animated Sticker",
      "emojis": metadata.emojis || ["🤣"]
    };
    await fs.writeJson(metaPath, metaObj);

    // Zip
    await new Promise((resolve, reject) => {
      const zipFile = new yazl.ZipFile();
      const outputStream = fs.createWriteStream(outputPath);
      outputStream.on("close", resolve);
      outputStream.on("error", reject);
      function addFiles(dir, prefix = "") {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const abs = path.join(dir, file);
          const rel = path.join(prefix, file);
          if (fs.statSync(abs).isDirectory()) addFiles(abs, rel);
          else zipFile.addFile(abs, rel.replace(/\\/g, "/"));
        }
      }
      addFiles(tempDir);
      zipFile.end();
      zipFile.outputStream.pipe(outputStream);
    });

    return outputPath;
  } finally {
    await fs.remove(tempDir);
  }
}
