import { ZERO_C, type Cycle, type Engine, type Pump } from './model';

export type Stage = 'cycle' | 'engine' | 'pump';
export interface Preset { key: string; stage: Stage; group: string; name: string; notice: string; cycle?: Cycle; engine?: Engine; pump?: Pump }

const c = (degrees: number) => degrees + ZERO_C;

export const CYCLE: Cycle = { tHot: 500, tCold: 300, ratio: 2, gas: 'monatomic', moles: 0.1 };
export const ENGINE: Engine = { conductance: 20, rate: 2, friction: 0 };
/** Each machine's usual temperatures and how leaky its box is, used when the mode is switched by hand. */
export const MACHINES: Record<Pump['mode'], Pump> = {
  fridge: { mode: 'fridge', tCold: c(4), tHot: c(22), gap: 10, quality: 0.5, leak: 1.5 },
  cooler: { mode: 'cooler', tCold: c(24), tHot: c(35), gap: 10, quality: 0.5, leak: 200 },
  heater: { mode: 'heater', tCold: c(7), tHot: c(21), gap: 10, quality: 0.5, leak: 200 },
};

export const PRESETS: Preset[] = [
  { key: 'carnot', stage: 'cycle', group: '1 · The cycle', name: 'The Carnot cycle', cycle: CYCLE,
    notice: 'A gas takes heat from something hot, expands, and pushes a piston. To get back to the start it must give some heat to something cold. Between 500 K and 300 K, 40% becomes work and no engine can do better.' },
  { key: 'steam', stage: 'cycle', group: '1 · The cycle', name: 'Power station temperatures', cycle: { ...CYCLE, tHot: 840, tCold: 300 },
    notice: 'Steam at 840 K and cooling water at 300 K allow at most 64%. Real plants reach about 45%. A hotter source is the only way to raise the limit, which is why turbines run as hot as their metal allows.' },
  { key: 'small-gap', stage: 'cycle', group: '1 · The cycle', name: 'A small temperature difference', cycle: { ...CYCLE, tHot: 320, tCold: 300 },
    notice: 'Warm sea water above cold deep water, 20 K apart. The loop on the pressure chart is a sliver and only 6% of the heat can become work. Heat at nearly the temperature of its surroundings is almost useless.' },
  { key: 'diatomic', stage: 'cycle', group: '1 · The cycle', name: 'A different gas', cycle: { ...CYCLE, gas: 'diatomic' },
    notice: 'Air instead of helium. Its molecules also spin, so it must expand much further to cool from 500 K to 300 K. The loop changes shape, but the efficiency is still exactly 40%: the limit does not depend on what is inside.' },

  { key: 'slow', stage: 'engine', group: '2 · A real engine', name: 'Nearly ideal, nearly useless', cycle: CYCLE, engine: { ...ENGINE, rate: 0.2 },
    notice: 'Carnot’s cycle only reaches its limit if heat flows across no temperature difference, which takes for ever. Run slowly, this engine is 39% efficient and produces almost nothing.' },
  { key: 'max-power', stage: 'engine', group: '2 · A real engine', name: 'Running for the most power', cycle: CYCLE, engine: { ...ENGINE, rate: 4.41 },
    notice: 'Speed up and the gas must run cooler than the source and warmer than the sink to pull heat through fast enough. Power peaks where efficiency has fallen to 1 − √(Tc/Th): 22.5% here. Real power stations sit close to this figure.' },
  { key: 'friction', stage: 'engine', group: '2 · A real engine', name: 'With friction', cycle: CYCLE, engine: { ...ENGINE, rate: 4.41, friction: 0.2 },
    notice: 'Friction turns a fifth of the work straight back into heat. It leaves at the cold end with the rest of the waste, and it makes entropy that no later step can remove.' },
  { key: 'stalled', stage: 'engine', group: '2 · A real engine', name: 'Driven too fast', cycle: CYCLE, engine: { ...ENGINE, rate: 10 },
    notice: 'Past a certain speed the gas cannot take in and give up heat fast enough to have a temperature difference of its own. Heat leaks from hot to cold and the engine produces no work at all.' },

  { key: 'fridge', stage: 'pump', group: '3 · Run it backwards', name: 'A kitchen refrigerator', pump: MACHINES.fridge,
    notice: 'Put work in and the cycle runs backwards: it takes heat from a cold place and gives it to a warm one. A refrigerator moves several joules of heat out of the food for each joule of electricity.' },
  { key: 'freezer', stage: 'pump', group: '3 · Run it backwards', name: 'A freezer', pump: { ...MACHINES.fridge, tCold: c(-18) },
    notice: 'The same machine holding −18 °C. Heat has to be lifted twice as far and leaks in twice as fast, so the freezer uses about four times the electricity of the refrigerator.' },
  { key: 'heat-pump', stage: 'pump', group: '3 · Run it backwards', name: 'A heat pump on a mild day', pump: MACHINES.heater,
    notice: 'A heat pump is a refrigerator that cools the outdoors and warms your room. Most of the heat it delivers was taken from the outside air for free, so it needs a fraction of the electricity of an electric heater.' },
  { key: 'heat-pump-cold', stage: 'pump', group: '3 · Run it backwards', name: 'A heat pump at −20 °C', pump: { ...MACHINES.heater, tCold: c(-20) },
    notice: 'Cold weather hurts twice. The house loses more heat, and each joule must be lifted further, so the heat pump moves less per joule of electricity. It still beats an electric heater by a wide margin.' },
  { key: 'heatwave', stage: 'pump', group: '3 · Run it backwards', name: 'An air conditioner in a heatwave', pump: { ...MACHINES.cooler, tHot: c(42) },
    notice: 'An air conditioner is a refrigerator whose box is your room. At 42 °C outside it must lift heat 18 K instead of 11 K while more leaks in: electricity use more than doubles on exactly the days the grid is under most strain.' },
];
