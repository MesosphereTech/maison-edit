import { curatedScenarios, curatedScenarioFor } from "./personalized-scenes.js";

// Brief feedback while actual prepared assets load; no simulated generation.
export const DEMO_COMPOSE_DURATION = 450;
export const DEMO_ASSET_DEADLINE = 2400;
export const DEMO_PREVIEW_SCENE_COUNT = 5;
export const DEMO_CRITICAL_SCENE_COUNT = 2;

// The catalog can grow without turning the visit setup into an image wall or a
// mandatory full-catalog download. Only the first pair gates store entry.
export function demoScenePreview(scenario) {
  return scenario.products.slice(0, DEMO_PREVIEW_SCENE_COUNT);
}

export function initialDemoScenario(profile) {
  return curatedScenarioFor(profile) || curatedScenarios[0];
}

// A test-scene choice never discards a shopper's own sizes, style notes or budget.
export function confirmedDemoProfile(profile, scenarioId) {
  const scenario = curatedScenarios.find((entry) => entry.id === scenarioId);
  if (!scenario) return null;
  return {
    ...profile,
    personaId: scenario.personaId,
    homeId: scenario.homeId,
    room: scenario.room,
    styles: [...profile.styles],
  };
}
