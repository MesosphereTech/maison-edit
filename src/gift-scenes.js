import { curatedScenarios } from "./personalized-scenes.js";
import { getPersonaPreset } from "./presets.js";
import { giftPackagingOptions, normalizeGift } from "./gift-packaging.js";

// A different shopping department can offer a gift *idea*. Only an explicit
// gift selection is ever persisted in the bag. These are fictional models.
export function giftSceneContext(item, profile = {}, preference = null) {
  if (!["women", "men"].includes(item?.category)) return null;
  const explicitGift = normalizeGift(preference);
  const department = [
    profile.department,
    profile.category,
    getPersonaPreset(profile.personaId)?.category,
  ].find((value) => ["women", "men"].includes(value));
  if (!explicitGift && (!department || item.category === department))
    return null;
  const model = curatedScenarios.find(
    (scenario) =>
      getPersonaPreset(scenario.personaId)?.category === item.category,
  );
  if (!model) return null;
  return {
    explicitGift: Boolean(explicitGift),
    profile: {
      ...profile,
      personaId: model.personaId,
      homeId: model.homeId,
      room: model.room,
    },
    packaging:
      giftPackagingOptions.find(
        (option) => option.id === explicitGift?.packagingId,
      ) || giftPackagingOptions[0],
  };
}
