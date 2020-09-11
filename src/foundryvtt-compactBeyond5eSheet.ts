// Import TypeScript modules
import { registerSettings } from './module/settings.js';
import { log, getActivationType } from './helpers';
import { preloadTemplates } from './module/preloadTemplates.js';
import { MODULE_ID, MySettings } from './constants.js';
//@ts-ignore
import ActorSheet5eCharacter from '../../systems/dnd5e/module/actor/sheets/character.js';

Handlebars.registerHelper('cb5es-path', (relativePath: string) => {
  return `modules/${MODULE_ID}/${relativePath}`;
});

Handlebars.registerHelper('cb5es-safeVal', (value, fallback) => {
  return new Handlebars.SafeString(value || fallback);
});

Handlebars.registerHelper('cb5es-add', (value: number, toAdd: number) => {
  return new Handlebars.SafeString(String(value + toAdd));
});

Handlebars.registerHelper('cb5es-isEmpty', (input: Object | Array<any> | Set<any>) => {
  if (input instanceof Array) {
    return input.length < 1;
  }
  if (input instanceof Set) {
    return input.size < 1;
  }
  return isObjectEmpty(input);
});

export class CompactBeyond5eSheet extends ActorSheet5eCharacter {
  get template() {
    // if ( !game.user.isGM && this.actor.limited ) return "modules/tidy5e-sheet/templates/tidy5e-sheet-ltd.html";
    return `modules/${MODULE_ID}/templates/character-sheet.hbs`;
  }

  static get defaultOptions(): FormApplicationOptions {
    const options = super.defaultOptions;

    mergeObject(options, {
      classes: ['dnd5e', 'sheet', 'actor', 'character', 'cb5es'],
      height: 680,
    });
    return options;
  }

  getData() {
    const sheetData = super.getData();

    // within each activation time, we want to display: Items which do damange, Spells which do damage, Features
    // MUTATED
    const actionsData: Record<string, Set<Item5e>> = {
      action: new Set(),
      bonus: new Set(),
      reaction: new Set(),
      special: new Set(),
    };

    try {
      // digest all weapons equipped populate the actionsData appropriate categories
      const weapons = sheetData?.inventory.find(({ label }) => label.includes('Weapon'))?.items; // brittle?

      const equippedWeapons = weapons.filter(({ data }) => data.equipped) || [];

      // MUTATES actionsData
      equippedWeapons.forEach((item) => {
        const actionType = item.data?.actionType;

        const actionTypeBonus = String(sheetData.data.bonuses?.[actionType]?.attack || 0);
        const relevantAbilityMod = sheetData.data.abilities[item.data?.ability]?.mod;
        const prof = sheetData.data.attributes.prof;
        const toHitLabel = String(Number(actionTypeBonus) + relevantAbilityMod + prof);

        const activationType = getActivationType(item.data?.activation?.type);

        actionsData[activationType].add({
          ...item,
          labels: {
            ...item.labels,
            toHit: toHitLabel,
          },
        });
      });
    } catch (e) {
      log('error trying to digest inventory', e);
    }

    try {
      // digest all prepared spells and populate the actionsData appropriate categories
      // MUTATES actionsData
      sheetData?.spellbook.forEach(({ spells, label }) => {
        // if the user only wants cantrips here, no nothing if the label does not include "Cantrip"
        if (game.settings.get(MODULE_ID, MySettings.limitActionsToCantrips)) {
          // brittle
          if (!label.includes('Cantrip')) {
            return;
          }
        }

        const preparedSpells = spells.filter(({ data }) => {
          if (data?.preparation?.mode === 'always') {
            return true;
          }
          return data?.preparation?.prepared;
        });

        const reactions = preparedSpells.filter(({ data }) => {
          return data?.activation?.type === 'reaction';
        });

        const damageDealers = preparedSpells.filter(({ data }) => {
          //ASSUMPTION: If the spell causes damage, it will have damageParts
          return data?.damage?.parts?.length > 0;
        });

        new Set([...damageDealers, ...reactions]).forEach((spell) => {
          const actionType = spell.data?.actionType;

          const actionTypeBonus = String(sheetData.data.bonuses?.[actionType]?.attack || 0);
          const spellcastingMod = sheetData.data.abilities[sheetData.data.attributes.spellcasting]?.mod;
          const prof = sheetData.data.attributes.prof;

          const toHitLabel = String(Number(actionTypeBonus) + spellcastingMod + prof);

          const activationType = getActivationType(spell.data?.activation?.type);

          actionsData[activationType].add({
            ...spell,
            labels: {
              ...spell.labels,
              toHit: toHitLabel,
            },
          });
        });
      });
    } catch (e) {
      log('error trying to digest spellbook', e);
    }

    try {
      const activeFeatures = sheetData?.features.find(({ label }) => label.includes('Active')).items || [];

      // MUTATES actionsData
      activeFeatures.forEach((item) => {
        const activationType = getActivationType(item.data?.activation?.type);

        actionsData[activationType].add(item);
      });
    } catch (e) {
      log('error trying to digest features', e);
    }
    sheetData.actionsData = actionsData;

    return sheetData;
  }
}

/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once('init', async function () {
  log(`Initializing ${MODULE_ID}`);

  // Assign custom classes and constants here

  // Register custom module settings
  registerSettings();

  // Preload Handlebars templates
  await preloadTemplates();

  // Register custom sheets (if any)
});

/* ------------------------------------ */
/* Setup module							*/
/* ------------------------------------ */
Hooks.once('setup', function () {
  // Do anything after initialization but before
  // ready
});

/* ------------------------------------ */
/* When ready							*/
/* ------------------------------------ */
Hooks.once('ready', function () {
  // Do anything once the module is ready
});

// Add any additional hooks if necessary

// Register compactBeyond5eSheet Sheet
Actors.registerSheet('dnd5e', CompactBeyond5eSheet, {
  types: ['character'],
  makeDefault: false,
});
