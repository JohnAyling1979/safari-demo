import { Jimp } from 'jimp';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

async function generateIcons() {
  await mkdir(publicDir, { recursive: true });

  for (const size of [16, 32, 48]) {
    const image = new Jimp({ width: size, height: size, color: 0x0066ccff });
    await image.write(join(publicDir, `icon-${size}.png`));
  }

  console.log('Generated icon-16.png, icon-32.png, icon-48.png');
}

generateIcons().catch(console.error);
