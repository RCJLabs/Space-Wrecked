// Small checks the data validators share (validate-data.js and
// validate-campaign.js). Each takes a value and says whether it is the kind
// asked for; the list helpers report through fail(where, message).

// file[key] as a list of objects, failing for anything else in it.
export function listOf(file, key, where, fail) {
  const list = file?.[key];
  if (!Array.isArray(list)) {
    fail(where, `"${key}" must be a list`);
    return [];
  }
  return list.filter((item, i) => {
    if (isObject(item)) return true;
    fail(where, `${key} #${i} must be an object`);
    return false;
  });
}

// The items' ids, failing for a malformed or repeated one.
export function uniqueIds(items, where, fail) {
  const ids = new Set();
  items.forEach((item, i) => {
    if (!isId(item.id)) {
      fail(where, `#${i}: id must be lowercase letters, digits and dashes`);
    } else if (ids.has(item.id)) {
      fail(where, `duplicate id "${item.id}"`);
    } else {
      ids.add(item.id);
    }
  });
  return ids;
}

// Fails for each field of an object not in keys.
export function knownKeys(object, keys, where, fail) {
  for (const key of Object.keys(object)) if (!keys.includes(key)) fail(where, `unknown field "${key}"`);
}

export function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isId(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value);
}

export function isText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

export function isIntIn(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function isListIn(value, min, max) {
  return Array.isArray(value) && value.length >= min && value.length <= max;
}

// [least, most]: whole numbers from min to max, least no more than most.
export function isRange(value, min, max) {
  return Array.isArray(value) && value.length === 2 && value.every((n) => isIntIn(n, min, max)) && value[0] <= value[1];
}
