import heroImg from "../assets/images/hero_flagship_smartphones_1794670594289.jpg";
import iphoneImg from "../assets/images/product_iphone_flagship_1794670594273.jpg";
import samsungImg from "../assets/images/product_samsung_flagship_1794670594103.jpg";
import accessoriesImg from "../assets/images/product_accessories_bundle_1794670595636.jpg";
import learnImg from "../assets/images/learn_device_inspection_1794670597188.jpg";

const MEDIA_MAP: Record<string, string> = {
  "media:hero": heroImg,
  "media:iphone": iphoneImg,
  "media:samsung": samsungImg,
  "media:accessories": accessoriesImg,
  "media:learn": learnImg,
};

export function resolveMediaUrl(keyOrUrl?: string | null): string {
  if (!keyOrUrl) return iphoneImg;
  if (MEDIA_MAP[keyOrUrl]) return MEDIA_MAP[keyOrUrl];
  if (keyOrUrl.startsWith("/uploads/") || keyOrUrl.startsWith("http") || keyOrUrl.startsWith("data:")) {
    return keyOrUrl;
  }
  return iphoneImg;
}

export { heroImg, iphoneImg, samsungImg, accessoriesImg, learnImg };
