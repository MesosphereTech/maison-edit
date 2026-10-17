import { modelOutfitScenes } from "./model-presets.js";
// Visually reviewed reference-guided synthetic full outfits. This registry binds
// only the catalog pieces whose primary-colour appearance was verified in pixels.
// Styling concepts do not promise physical product identity, measurements or fit.
export const outfitScenes = [
  ...modelOutfitScenes,
  {
    id: "woman-coat-street",
    personaId: "everyday-woman-45",
    homeId: "warm-family",
    src: "/outfit-scenes/woman-coat-street-v1.webp",
    kind: "outfit",
    sceneZh: "秋日林荫道 · 城市漫步",
    sceneEn: "Autumn boulevard · a city walk",
    primarySkuIds: ["ME-009"],
    products: [
      { skuId: "ME-009", color: "Camel" },
      { skuId: "ME-002", color: "Ivory" },
      { skuId: "ME-003", color: "Walnut" },
      { skuId: "ME-004", color: "Burgundy" },
      { skuId: "ME-007", color: "Burgundy" },
    ],
  },
  {
    id: "woman-dress-dinner",
    personaId: "everyday-woman-45",
    homeId: "warm-family",
    src: "/outfit-scenes/woman-dress-dinner-v1.webp",
    kind: "outfit",
    sceneZh: "庭院餐厅 · 暖光晚餐",
    sceneEn: "Courtyard restaurant · an easy dinner",
    primarySkuIds: ["ME-015"],
    products: [
      { skuId: "ME-015", color: "Terracotta" },
      { skuId: "ME-004", color: "Burgundy" },
      { skuId: "ME-007", color: "Burgundy" },
    ],
  },
  {
    id: "woman-knit-skirt-cafe",
    personaId: "everyday-woman-45",
    homeId: "warm-family",
    src: "/outfit-scenes/woman-knit-skirt-cafe-v1.webp",
    kind: "outfit",
    sceneZh: "木质咖啡馆 · 柔和日常",
    sceneEn: "Wood-front café · softer everyday",
    primarySkuIds: ["ME-005", "ME-006"],
    products: [
      { skuId: "ME-006", color: "Oat" },
      { skuId: "ME-005", color: "Champagne" },
      { skuId: "ME-004", color: "Burgundy" },
      { skuId: "ME-007", color: "Burgundy" },
    ],
  },
  {
    id: "woman-weekend-courtyard",
    personaId: "everyday-woman-45",
    homeId: "warm-family",
    src: "/outfit-scenes/woman-weekend-courtyard-v1.webp",
    kind: "outfit",
    sceneZh: "花园庭院 · 轻松周末",
    sceneEn: "Garden courtyard · an easy weekend",
    primarySkuIds: ["ME-025", "ME-026"],
    products: [
      { skuId: "ME-025", color: "Oat" },
      { skuId: "ME-026", color: "Blue" },
      { skuId: "ME-003", color: "Walnut" },
      { skuId: "ME-007", color: "Burgundy" },
      { skuId: "ME-027", color: "Oat" },
    ],
  },
  {
    id: "man-knit-cafe",
    personaId: "relaxed-man-50",
    homeId: "compact-city",
    src: "/outfit-scenes/man-knit-cafe-v1.webp",
    kind: "outfit",
    sceneZh: "街边咖啡馆 · 休闲日常",
    sceneEn: "Neighborhood café · relaxed everyday",
    primarySkuIds: ["ME-014"],
    products: [
      { skuId: "ME-014", color: "Oat" },
      { skuId: "ME-011", color: "Ink" },
      { skuId: "ME-013", color: "Walnut" },
      { skuId: "ME-027", color: "Oat" },
    ],
  },
  {
    id: "woman-tailoring-city",
    personaId: "everyday-woman-45",
    homeId: "warm-family",
    src: "/outfit-scenes/woman-tailoring-city-v1.webp",
    kind: "outfit",
    sceneZh: "城市拱廊 · 日常通勤",
    sceneEn: "City arcade · everyday tailoring",
    primarySkuIds: ["ME-001", "ME-002", "ME-003"],
    products: [
      { skuId: "ME-001", color: "Walnut" },
      { skuId: "ME-002", color: "Ivory" },
      { skuId: "ME-003", color: "Walnut" },
      { skuId: "ME-004", color: "Burgundy" },
      { skuId: "ME-007", color: "Burgundy" },
    ],
  },
  {
    id: "man-tailoring-city",
    personaId: "relaxed-man-50",
    homeId: "compact-city",
    src: "/outfit-scenes/man-tailoring-city-v1.webp",
    kind: "outfit",
    sceneZh: "城市街角 · 从容通勤",
    sceneEn: "City café · considered tailoring",
    primarySkuIds: ["ME-010", "ME-011", "ME-012"],
    products: [
      { skuId: "ME-012", color: "Ink" },
      { skuId: "ME-010", color: "Chalk" },
      { skuId: "ME-011", color: "Ink" },
      { skuId: "ME-013", color: "Walnut" },
      { skuId: "ME-016", color: "Walnut" },
    ],
  },
];
export function outfitSceneFor(skuId, profile = {}, color) {
  const valid = outfitScenes.filter(
    (scene) =>
      scene.personaId === profile.personaId &&
      scene.homeId === profile.homeId &&
      profile.room === "living" &&
      scene.products.some(
        (product) =>
          product.skuId === skuId && (!color || product.color === color),
      ),
  );
  return (
    valid.find((scene) => scene.primarySkuIds.includes(skuId)) ||
    valid[0] ||
    null
  );
}
