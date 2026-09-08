export const TRAJECTORY_VIEW_DIRECTION = Object.freeze([.6, .45, 1]);

/** A separate, Sun-following demonstration, away from the exploration scene. */
export const trajectoryAnchor = [0, 6000, 0];

export const trajectoryDefinition = {
  id: 'trajectory', kind: 'trajectory', cn: '运动轨迹', en: 'SOLAR SYSTEM IN MOTION',
  index: '09', type: '太阳系 · 运动示意', r: 1, viewDistance: 600,
  position: [-150, 5970, -60],
  desc: '跟随太阳前行，看八颗行星在公转中留下轨迹。切换参照系，可对照向前延伸的曲线与围绕太阳的运行轨道。',
  stat1: '追踪天体', diameter: '太阳 + 8', unit1: '行星',
  stat2: '运动比例', value2: '演示', unit2: '非等比',
  sourceUrl: 'https://science.nasa.gov/solar-system/solar-system-facts/', sourceLabel: 'NASA · 太阳系运动',
};
