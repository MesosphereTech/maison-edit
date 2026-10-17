// Original fictional adult models. Catalog-referenced synthetic concepts, never verified product photos or fit.
export const modelPersonaPresets = [
  {
    id: "claire-model-32",
    zh: "Claire · 32 岁模特",
    en: "Claire · model, 32",
    bodyZh: "高挑匀称身形",
    bodyEn: "Tall, slender build",
    height: 175,
    size: "S",
    category: "women",
    styles: ["quiet", "tailored"],
    measurementsIllustrative: true,
    syntheticModel: true,
    image: "/model-presets/claire-portrait.webp",
  },
  {
    id: "julian-model-34",
    zh: "Julian · 34 岁模特",
    en: "Julian · model, 34",
    bodyZh: "高挑健朗身形",
    bodyEn: "Tall, athletic build",
    height: 186,
    size: "L",
    category: "men",
    styles: ["quiet", "tailored"],
    measurementsIllustrative: true,
    syntheticModel: true,
    image: "/model-presets/julian-portrait.webp",
  },
];

export const modelOutfitScenes = [
  {
    id: "v17-claire-tailoring",
    personaId: "claire-model-32",
    homeId: "warm-family",
    src: "/personalized-scenes/v17-claire-tailoring.webp",
    kind: "outfit",
    sceneZh: "城市拱廊 · 轻松剪裁",
    sceneEn: "City arcade · effortless tailoring",
    primarySkuIds: ["ME-001", "ME-002", "ME-003"],
    products: [
      {
        skuId: "ME-001",
        color: "Walnut",
      },
      {
        skuId: "ME-002",
        color: "Ivory",
      },
      {
        skuId: "ME-003",
        color: "Walnut",
      },
      {
        skuId: "ME-004",
        color: "Burgundy",
      },
      {
        skuId: "ME-007",
        color: "Burgundy",
      },
      {
        skuId: "ME-008",
        color: "Brass",
      },
    ],
  },
  {
    id: "v17-claire-coat",
    personaId: "claire-model-32",
    homeId: "warm-family",
    src: "/personalized-scenes/v17-claire-coat.webp",
    kind: "outfit",
    sceneZh: "秋日林荫道 · 城市漫步",
    sceneEn: "Autumn boulevard · a city walk",
    primarySkuIds: ["ME-009"],
    products: [
      {
        skuId: "ME-009",
        color: "Camel",
      },
      {
        skuId: "ME-002",
        color: "Ivory",
      },
      {
        skuId: "ME-003",
        color: "Walnut",
      },
      {
        skuId: "ME-004",
        color: "Burgundy",
      },
      {
        skuId: "ME-007",
        color: "Burgundy",
      },
    ],
  },
  {
    id: "v17-claire-dress",
    personaId: "claire-model-32",
    homeId: "warm-family",
    src: "/personalized-scenes/v17-claire-dress.webp",
    kind: "outfit",
    sceneZh: "庭院餐厅 · 暖光晚餐",
    sceneEn: "Courtyard restaurant · a warm evening",
    primarySkuIds: ["ME-015", "ME-008"],
    products: [
      {
        skuId: "ME-015",
        color: "Terracotta",
      },
      {
        skuId: "ME-004",
        color: "Burgundy",
      },
      {
        skuId: "ME-007",
        color: "Burgundy",
      },
      {
        skuId: "ME-008",
        color: "Brass",
      },
    ],
  },
  {
    id: "v17-claire-knit-skirt",
    personaId: "claire-model-32",
    homeId: "warm-family",
    src: "/personalized-scenes/v17-claire-knit-skirt.webp",
    kind: "outfit",
    sceneZh: "木质咖啡馆 · 柔和日常",
    sceneEn: "Oak café · softer everyday",
    primarySkuIds: ["ME-005", "ME-006"],
    products: [
      {
        skuId: "ME-006",
        color: "Oat",
      },
      {
        skuId: "ME-005",
        color: "Champagne",
      },
      {
        skuId: "ME-004",
        color: "Burgundy",
      },
      {
        skuId: "ME-007",
        color: "Burgundy",
      },
    ],
  },
  {
    id: "v17-claire-weekend",
    personaId: "claire-model-32",
    homeId: "warm-family",
    src: "/personalized-scenes/v17-claire-weekend.webp",
    kind: "outfit",
    sceneZh: "花园庭院 · 轻松周末",
    sceneEn: "Garden courtyard · an easy weekend",
    primarySkuIds: ["ME-025", "ME-026", "ME-027"],
    products: [
      {
        skuId: "ME-025",
        color: "Oat",
      },
      {
        skuId: "ME-026",
        color: "Blue",
      },
      {
        skuId: "ME-003",
        color: "Walnut",
      },
      {
        skuId: "ME-007",
        color: "Burgundy",
      },
      {
        skuId: "ME-027",
        color: "Oat",
      },
    ],
  },
  {
    id: "v17-julian-tailoring",
    personaId: "julian-model-34",
    homeId: "compact-city",
    src: "/personalized-scenes/v17-julian-tailoring.webp",
    kind: "outfit",
    sceneZh: "城市咖啡馆 · 从容剪裁",
    sceneEn: "City café · considered tailoring",
    primarySkuIds: ["ME-010", "ME-011", "ME-012", "ME-016"],
    products: [
      {
        skuId: "ME-012",
        color: "Ink",
      },
      {
        skuId: "ME-010",
        color: "Chalk",
      },
      {
        skuId: "ME-011",
        color: "Ink",
      },
      {
        skuId: "ME-013",
        color: "Walnut",
      },
      {
        skuId: "ME-016",
        color: "Walnut",
      },
    ],
  },
  {
    id: "v17-julian-knit",
    personaId: "julian-model-34",
    homeId: "compact-city",
    src: "/personalized-scenes/v17-julian-knit.webp",
    kind: "outfit",
    sceneZh: "明亮咖啡馆 · 舒适日常",
    sceneEn: "Airy café · relaxed everyday",
    primarySkuIds: ["ME-014", "ME-013", "ME-027"],
    products: [
      {
        skuId: "ME-014",
        color: "Oat",
      },
      {
        skuId: "ME-011",
        color: "Ink",
      },
      {
        skuId: "ME-013",
        color: "Walnut",
      },
      {
        skuId: "ME-027",
        color: "Oat",
      },
    ],
  },
];

export const modelScenarios = [
  {
    id: "claire-city-edit",
    personaId: "claire-model-32",
    homeId: "warm-family",
    room: "living",
    zh: "Claire 的城市衣橱",
    en: "Claire’s city edit",
    noteZh: "32 岁虚构模特 · 城市剪裁与柔和日常",
    noteEn: "Fictional model, 32 · city tailoring and softer everyday",
    assetCount: 5,
    coverageZh: "其余商品保留原始商品概念图，不使用其他人物的场景。",
    coverageEn:
      "Other pieces retain original product concepts; another person’s scenes are never substituted.",
    products: [
      {
        skuId: "ME-015",
        color: "Terracotta",
        type: "outfit",
        file: "v17-claire-dress.webp",
        personaId: "claire-model-32",
        homeId: "warm-family",
        sceneZh: "庭院餐厅 · 暖光晚餐",
        sceneEn: "Courtyard restaurant · a warm evening",
        products: [
          {
            skuId: "ME-015",
            color: "Terracotta",
          },
          {
            skuId: "ME-004",
            color: "Burgundy",
          },
          {
            skuId: "ME-007",
            color: "Burgundy",
          },
          {
            skuId: "ME-008",
            color: "Brass",
          },
        ],
      },
      {
        skuId: "ME-009",
        color: "Camel",
        type: "outfit",
        file: "v17-claire-coat.webp",
        personaId: "claire-model-32",
        homeId: "warm-family",
        sceneZh: "秋日林荫道 · 城市漫步",
        sceneEn: "Autumn boulevard · a city walk",
        products: [
          {
            skuId: "ME-009",
            color: "Camel",
          },
          {
            skuId: "ME-002",
            color: "Ivory",
          },
          {
            skuId: "ME-003",
            color: "Walnut",
          },
          {
            skuId: "ME-004",
            color: "Burgundy",
          },
          {
            skuId: "ME-007",
            color: "Burgundy",
          },
        ],
      },
      {
        skuId: "ME-006",
        color: "Oat",
        type: "outfit",
        file: "v17-claire-knit-skirt.webp",
        personaId: "claire-model-32",
        homeId: "warm-family",
        sceneZh: "木质咖啡馆 · 柔和日常",
        sceneEn: "Oak café · softer everyday",
        products: [
          {
            skuId: "ME-006",
            color: "Oat",
          },
          {
            skuId: "ME-005",
            color: "Champagne",
          },
          {
            skuId: "ME-004",
            color: "Burgundy",
          },
          {
            skuId: "ME-007",
            color: "Burgundy",
          },
        ],
      },
      {
        skuId: "ME-025",
        color: "Oat",
        type: "outfit",
        file: "v17-claire-weekend.webp",
        personaId: "claire-model-32",
        homeId: "warm-family",
        sceneZh: "花园庭院 · 轻松周末",
        sceneEn: "Garden courtyard · an easy weekend",
        products: [
          {
            skuId: "ME-025",
            color: "Oat",
          },
          {
            skuId: "ME-026",
            color: "Blue",
          },
          {
            skuId: "ME-003",
            color: "Walnut",
          },
          {
            skuId: "ME-007",
            color: "Burgundy",
          },
          {
            skuId: "ME-027",
            color: "Oat",
          },
        ],
      },
      {
        skuId: "ME-001",
        color: "Walnut",
        type: "outfit",
        file: "v17-claire-tailoring.webp",
        personaId: "claire-model-32",
        homeId: "warm-family",
        sceneZh: "城市拱廊 · 轻松剪裁",
        sceneEn: "City arcade · effortless tailoring",
        products: [
          {
            skuId: "ME-001",
            color: "Walnut",
          },
          {
            skuId: "ME-002",
            color: "Ivory",
          },
          {
            skuId: "ME-003",
            color: "Walnut",
          },
          {
            skuId: "ME-004",
            color: "Burgundy",
          },
          {
            skuId: "ME-007",
            color: "Burgundy",
          },
          {
            skuId: "ME-008",
            color: "Brass",
          },
        ],
      },
      {
        skuId: "ME-002",
        color: "Ivory",
        type: "outfit",
        file: "v17-claire-tailoring.webp",
        personaId: "claire-model-32",
        homeId: "warm-family",
        sceneZh: "城市拱廊 · 轻松剪裁",
        sceneEn: "City arcade · effortless tailoring",
        products: [
          {
            skuId: "ME-001",
            color: "Walnut",
          },
          {
            skuId: "ME-002",
            color: "Ivory",
          },
          {
            skuId: "ME-003",
            color: "Walnut",
          },
          {
            skuId: "ME-004",
            color: "Burgundy",
          },
          {
            skuId: "ME-007",
            color: "Burgundy",
          },
          {
            skuId: "ME-008",
            color: "Brass",
          },
        ],
      },
      {
        skuId: "ME-003",
        color: "Walnut",
        type: "outfit",
        file: "v17-claire-tailoring.webp",
        personaId: "claire-model-32",
        homeId: "warm-family",
        sceneZh: "城市拱廊 · 轻松剪裁",
        sceneEn: "City arcade · effortless tailoring",
        products: [
          {
            skuId: "ME-001",
            color: "Walnut",
          },
          {
            skuId: "ME-002",
            color: "Ivory",
          },
          {
            skuId: "ME-003",
            color: "Walnut",
          },
          {
            skuId: "ME-004",
            color: "Burgundy",
          },
          {
            skuId: "ME-007",
            color: "Burgundy",
          },
          {
            skuId: "ME-008",
            color: "Brass",
          },
        ],
      },
      {
        skuId: "ME-004",
        color: "Burgundy",
        type: "outfit",
        file: "v17-claire-tailoring.webp",
        personaId: "claire-model-32",
        homeId: "warm-family",
        sceneZh: "城市拱廊 · 轻松剪裁",
        sceneEn: "City arcade · effortless tailoring",
        products: [
          {
            skuId: "ME-001",
            color: "Walnut",
          },
          {
            skuId: "ME-002",
            color: "Ivory",
          },
          {
            skuId: "ME-003",
            color: "Walnut",
          },
          {
            skuId: "ME-004",
            color: "Burgundy",
          },
          {
            skuId: "ME-007",
            color: "Burgundy",
          },
          {
            skuId: "ME-008",
            color: "Brass",
          },
        ],
      },
      {
        skuId: "ME-005",
        color: "Champagne",
        type: "outfit",
        file: "v17-claire-knit-skirt.webp",
        personaId: "claire-model-32",
        homeId: "warm-family",
        sceneZh: "木质咖啡馆 · 柔和日常",
        sceneEn: "Oak café · softer everyday",
        products: [
          {
            skuId: "ME-006",
            color: "Oat",
          },
          {
            skuId: "ME-005",
            color: "Champagne",
          },
          {
            skuId: "ME-004",
            color: "Burgundy",
          },
          {
            skuId: "ME-007",
            color: "Burgundy",
          },
        ],
      },
      {
        skuId: "ME-007",
        color: "Burgundy",
        type: "outfit",
        file: "v17-claire-tailoring.webp",
        personaId: "claire-model-32",
        homeId: "warm-family",
        sceneZh: "城市拱廊 · 轻松剪裁",
        sceneEn: "City arcade · effortless tailoring",
        products: [
          {
            skuId: "ME-001",
            color: "Walnut",
          },
          {
            skuId: "ME-002",
            color: "Ivory",
          },
          {
            skuId: "ME-003",
            color: "Walnut",
          },
          {
            skuId: "ME-004",
            color: "Burgundy",
          },
          {
            skuId: "ME-007",
            color: "Burgundy",
          },
          {
            skuId: "ME-008",
            color: "Brass",
          },
        ],
      },
      {
        skuId: "ME-008",
        color: "Brass",
        type: "outfit",
        file: "v17-claire-dress.webp",
        personaId: "claire-model-32",
        homeId: "warm-family",
        sceneZh: "庭院餐厅 · 暖光晚餐",
        sceneEn: "Courtyard restaurant · a warm evening",
        products: [
          {
            skuId: "ME-015",
            color: "Terracotta",
          },
          {
            skuId: "ME-004",
            color: "Burgundy",
          },
          {
            skuId: "ME-007",
            color: "Burgundy",
          },
          {
            skuId: "ME-008",
            color: "Brass",
          },
        ],
      },
      {
        skuId: "ME-026",
        color: "Blue",
        type: "outfit",
        file: "v17-claire-weekend.webp",
        personaId: "claire-model-32",
        homeId: "warm-family",
        sceneZh: "花园庭院 · 轻松周末",
        sceneEn: "Garden courtyard · an easy weekend",
        products: [
          {
            skuId: "ME-025",
            color: "Oat",
          },
          {
            skuId: "ME-026",
            color: "Blue",
          },
          {
            skuId: "ME-003",
            color: "Walnut",
          },
          {
            skuId: "ME-007",
            color: "Burgundy",
          },
          {
            skuId: "ME-027",
            color: "Oat",
          },
        ],
      },
      {
        skuId: "ME-027",
        color: "Oat",
        type: "outfit",
        file: "v17-claire-weekend.webp",
        personaId: "claire-model-32",
        homeId: "warm-family",
        sceneZh: "花园庭院 · 轻松周末",
        sceneEn: "Garden courtyard · an easy weekend",
        products: [
          {
            skuId: "ME-025",
            color: "Oat",
          },
          {
            skuId: "ME-026",
            color: "Blue",
          },
          {
            skuId: "ME-003",
            color: "Walnut",
          },
          {
            skuId: "ME-007",
            color: "Burgundy",
          },
          {
            skuId: "ME-027",
            color: "Oat",
          },
        ],
      },
    ],
  },
  {
    id: "julian-city-edit",
    personaId: "julian-model-34",
    homeId: "compact-city",
    room: "living",
    zh: "Julian 的从容衣橱",
    en: "Julian’s considered edit",
    noteZh: "34 岁虚构模特 · 精致剪裁与舒适层搭",
    noteEn: "Fictional model, 34 · considered tailoring and easy layers",
    assetCount: 2,
    coverageZh: "其余商品保留原始商品概念图，不使用其他人物的场景。",
    coverageEn:
      "Other pieces retain original product concepts; another person’s scenes are never substituted.",
    products: [
      {
        skuId: "ME-014",
        color: "Oat",
        type: "outfit",
        file: "v17-julian-knit.webp",
        personaId: "julian-model-34",
        homeId: "compact-city",
        sceneZh: "明亮咖啡馆 · 舒适日常",
        sceneEn: "Airy café · relaxed everyday",
        products: [
          {
            skuId: "ME-014",
            color: "Oat",
          },
          {
            skuId: "ME-011",
            color: "Ink",
          },
          {
            skuId: "ME-013",
            color: "Walnut",
          },
          {
            skuId: "ME-027",
            color: "Oat",
          },
        ],
      },
      {
        skuId: "ME-012",
        color: "Ink",
        type: "outfit",
        file: "v17-julian-tailoring.webp",
        personaId: "julian-model-34",
        homeId: "compact-city",
        sceneZh: "城市咖啡馆 · 从容剪裁",
        sceneEn: "City café · considered tailoring",
        products: [
          {
            skuId: "ME-012",
            color: "Ink",
          },
          {
            skuId: "ME-010",
            color: "Chalk",
          },
          {
            skuId: "ME-011",
            color: "Ink",
          },
          {
            skuId: "ME-013",
            color: "Walnut",
          },
          {
            skuId: "ME-016",
            color: "Walnut",
          },
        ],
      },
      {
        skuId: "ME-010",
        color: "Chalk",
        type: "outfit",
        file: "v17-julian-tailoring.webp",
        personaId: "julian-model-34",
        homeId: "compact-city",
        sceneZh: "城市咖啡馆 · 从容剪裁",
        sceneEn: "City café · considered tailoring",
        products: [
          {
            skuId: "ME-012",
            color: "Ink",
          },
          {
            skuId: "ME-010",
            color: "Chalk",
          },
          {
            skuId: "ME-011",
            color: "Ink",
          },
          {
            skuId: "ME-013",
            color: "Walnut",
          },
          {
            skuId: "ME-016",
            color: "Walnut",
          },
        ],
      },
      {
        skuId: "ME-013",
        color: "Walnut",
        type: "outfit",
        file: "v17-julian-knit.webp",
        personaId: "julian-model-34",
        homeId: "compact-city",
        sceneZh: "明亮咖啡馆 · 舒适日常",
        sceneEn: "Airy café · relaxed everyday",
        products: [
          {
            skuId: "ME-014",
            color: "Oat",
          },
          {
            skuId: "ME-011",
            color: "Ink",
          },
          {
            skuId: "ME-013",
            color: "Walnut",
          },
          {
            skuId: "ME-027",
            color: "Oat",
          },
        ],
      },
      {
        skuId: "ME-027",
        color: "Oat",
        type: "outfit",
        file: "v17-julian-knit.webp",
        personaId: "julian-model-34",
        homeId: "compact-city",
        sceneZh: "明亮咖啡馆 · 舒适日常",
        sceneEn: "Airy café · relaxed everyday",
        products: [
          {
            skuId: "ME-014",
            color: "Oat",
          },
          {
            skuId: "ME-011",
            color: "Ink",
          },
          {
            skuId: "ME-013",
            color: "Walnut",
          },
          {
            skuId: "ME-027",
            color: "Oat",
          },
        ],
      },
      {
        skuId: "ME-011",
        color: "Ink",
        type: "outfit",
        file: "v17-julian-tailoring.webp",
        personaId: "julian-model-34",
        homeId: "compact-city",
        sceneZh: "城市咖啡馆 · 从容剪裁",
        sceneEn: "City café · considered tailoring",
        products: [
          {
            skuId: "ME-012",
            color: "Ink",
          },
          {
            skuId: "ME-010",
            color: "Chalk",
          },
          {
            skuId: "ME-011",
            color: "Ink",
          },
          {
            skuId: "ME-013",
            color: "Walnut",
          },
          {
            skuId: "ME-016",
            color: "Walnut",
          },
        ],
      },
      {
        skuId: "ME-016",
        color: "Walnut",
        type: "outfit",
        file: "v17-julian-tailoring.webp",
        personaId: "julian-model-34",
        homeId: "compact-city",
        sceneZh: "城市咖啡馆 · 从容剪裁",
        sceneEn: "City café · considered tailoring",
        products: [
          {
            skuId: "ME-012",
            color: "Ink",
          },
          {
            skuId: "ME-010",
            color: "Chalk",
          },
          {
            skuId: "ME-011",
            color: "Ink",
          },
          {
            skuId: "ME-013",
            color: "Walnut",
          },
          {
            skuId: "ME-016",
            color: "Walnut",
          },
        ],
      },
    ],
  },
];
