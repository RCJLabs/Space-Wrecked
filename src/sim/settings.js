// Player settings. Pure: plain data in, plain data out.

// 60 is the target; 30 is the battery setting.
export const FPS_CAPS = [60, 30];

export function defaultSettings() {
  return { fpsCap: 60 };
}

export function reduceSettings(settings, action) {
  switch (action.type) {
    case 'settings/fpsCap':
      if (!FPS_CAPS.includes(action.value) || action.value === settings.fpsCap) return settings;
      return { ...settings, fpsCap: action.value };
    default:
      return settings;
  }
}
