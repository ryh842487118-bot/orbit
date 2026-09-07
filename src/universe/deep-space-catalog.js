// Research notes: docs/deep-space-sources.md (reviewed 2026-09-07).
// Positions, radii, orbit speeds and surface patterns are composed for exploration.
// modelStatus describes the object, never the scientific accuracy of its artwork.
const galaxyDefinitions = [
  {
    id: 'andromeda', kind: 'galaxy', cn: '仙女座星系', en: 'ANDROMEDA · M31', index: 'M31',
    type: '本星系群 / 螺旋星系', parentId: 'local-group', r: 1,
    position: [240000, 35000, -180000], radius: 38000, viewDistance: 98800,
    shape: 'spiral', tilt: [0.34, 0.18, -0.26], arms: 2, color: 0xa7bbff,
    diameter: '约 250 万', stat1: '距地球', unit1: '光年',
    stat2: '星系编号', value2: 'M31', unit2: '',
    desc: '距离我们约 250 万光年的螺旋星系，明亮的中央核球外展开宽阔星盘。飞入旋臂，寻找 AF And 和 AE And 这两颗明亮的蓝变星。',
    sourceUrl: 'https://www.jpl.nasa.gov/images/pia15416-andromeda/',
    sourceLabel: 'NASA / JPL · 仙女座星系', modelStatus: 'confirmed',
    appearance: '暖白核球、冷蓝双旋臂与稀疏尘带',
  },
  {
    id: 'triangulum', kind: 'galaxy', cn: '三角座星系', en: 'TRIANGULUM · M33', index: 'M33',
    type: '本星系群 / 螺旋星系', parentId: 'local-group', r: 1,
    position: [-210000, -18000, -210000], radius: 22000, viewDistance: 57200,
    shape: 'spiral', tilt: [-0.2, 0.7, 0.17], arms: 3, color: 0x87dce7,
    diameter: '约 300 万', stat1: '距地球', unit1: '光年',
    stat2: '星系编号', value2: 'M33', unit2: '',
    desc: '三角座星系拥有疏朗的螺旋结构，是本星系群的主要成员之一。恒星诞生区点亮星盘，罗马诺之星则展示着大质量恒星的多变面貌。',
    sourceUrl: 'https://www.nasa.gov/image-article/triangulum-galaxy-3/',
    sourceLabel: 'NASA · 三角座星系', modelStatus: 'confirmed',
    appearance: '青蓝疏旋臂、较小核球与粉色恒星诞生区',
  },
  {
    id: 'lmc', kind: 'galaxy', cn: '大麦哲伦星云', en: 'LARGE MAGELLANIC CLOUD', index: 'LMC',
    type: '本星系群 / 不规则矮星系', parentId: 'local-group', r: 1,
    position: [100000, -65000, 80000], radius: 11000, viewDistance: 28600,
    shape: 'irregular', tilt: [0.16, -0.35, 0.31], arms: 0, color: 0x91cfed,
    diameter: '约 16 万', stat1: '距地球', unit1: '光年',
    stat2: '著名区域', value2: '蜘蛛星云', unit2: '',
    desc: '名字叫星云，其实是一座邻近的矮星系。散开的星光与气体云中，藏着 R136a1 和被尘埃包围的 WOH G64 等引人注目的大质量恒星。',
    sourceUrl: 'https://science.nasa.gov/earth/earth-observatory/the-galaxy-next-door/',
    sourceLabel: 'NASA · 大麦哲伦星云', modelStatus: 'confirmed',
    appearance: '不对称蓝白星群、中央短棒与偏置粉色云团',
  },
  {
    id: 'smc', kind: 'galaxy', cn: '小麦哲伦星云', en: 'SMALL MAGELLANIC CLOUD', index: 'SMC',
    type: '本星系群 / 不规则矮星系', parentId: 'local-group', r: 1,
    position: [160000, -95000, 110000], radius: 7000, viewDistance: 18200,
    shape: 'irregular', tilt: [-0.24, 0.2, -0.3], arms: 0, color: 0xb5b9ef,
    diameter: '约 20 万', stat1: '距地球', unit1: '光年',
    stat2: '恒星目的地', value2: 'HD 5980', unit2: '',
    desc: '一座位于银河附近的不规则矮星系，星光呈松散的云状分布。靠近 NGC 346 一带，探索拥有强烈恒星风的 HD 5980 大质量多星系统。',
    sourceUrl: 'https://science.nasa.gov/photojournal/little-galaxy-explored/',
    sourceLabel: 'NASA · 小麦哲伦星云', modelStatus: 'confirmed',
    appearance: '淡紫疏散星群与不对称羽翼',
  },
];

const localGroupDefinition = {
  id: 'local-group', kind: 'group', cn: '本星系群', en: 'THE LOCAL GROUP', index: 'LG',
  type: '宇宙邻里 / 星系群', r: 1, position: [50000, -50000, 30000], viewDistance: 820000,
  color: 0xb7c8ee, diameter: '5', stat1: '开放探索', unit1: '座星系',
  stat2: '所在星系', value2: '银河系', unit2: '',
  desc: '把银河放回更辽阔的宇宙邻里。这里开放银河、仙女座、三角座和大小麦哲伦星云五座星系；星系间距与天体尺寸经过压缩，便于自由漫游。',
  sourceUrl: 'https://imagine.gsfc.nasa.gov/features/cosmic/local_group_info.html',
  sourceLabel: 'NASA · 本星系群', modelStatus: 'confirmed',
  appearance: '五座可抵达的星系散布于深空',
};

function star(definition) {
  return {
    kind: 'star', modelStatus: 'confirmed', unit1: '', unit2: '',
    parentId: definition.parentGalaxy,
    ...definition,
  };
}

const stars = [
  star({
    id: 'betelgeuse', cn: '参宿四', en: 'BETELGEUSE', index: 'α ORI',
    type: '银河系 / 红超巨星', parentGalaxy: 'galaxy',
    position: [-23000, -350, 4800], r: 30, surfaceStyle: 'red-star', color: 0xff8656,
    diameter: '约 1,000', stat1: '直径量级', unit1: '太阳直径',
    stat2: '所属星座', value2: '猎户座',
    desc: '猎户座肩头的橙红色恒星，已经膨胀成红超巨星。它的外层不断变化并向外释放物质；这里用翻涌的暖色表面表现这颗庞大的恒星，尺寸仅展示量级。',
    sourceUrl: 'https://www.esa.int/Science_Exploration/Space_Science/Betelgeuse_braces_for_a_collision',
    sourceLabel: 'ESA · 参宿四', appearance: '橙红对流斑与宽阔柔光',
  }),
  star({
    id: 'hr8799', cn: 'HR 8799', en: 'HR 8799', index: 'HR',
    type: '银河系 / 巨行星系统宿主', parentGalaxy: 'galaxy',
    position: [-11000, 750, -4300], r: 9, surfaceStyle: 'gold-star', color: 0xffe4b9,
    diameter: '4', stat1: '已确认巨行星', unit1: '颗',
    stat2: '探测方式', value2: '直接成像',
    desc: '这颗恒星周围有四颗通过直接成像研究的巨大系外行星。依次飞向 b、c、d、e，观察不同的云带；表面细节与演示轨道经过艺术化处理。',
    sourceUrl: 'https://exoplanetarchive.ipac.caltech.edu/overview/HR%208799',
    sourceLabel: 'NASA 系外行星档案 · HR 8799', appearance: '柔和暖白恒星与四层行星轨道',
  }),
  star({
    id: 'af-and', cn: '仙女座 AF', en: 'AF ANDROMEDAE', index: 'AF',
    type: '仙女座星系 / 高光度蓝变星', parentGalaxy: 'andromeda',
    position: [246600, 35350, -184300], r: 22, surfaceStyle: 'blue-star', color: 0x96caff,
    diameter: 'M31', stat1: '所在星系', stat2: '恒星类型', value2: '蓝变星',
    desc: 'AF And 是仙女座星系中已知的高光度蓝变星之一。它的亮度与光谱会发生变化，是研究大质量恒星演化的窗口；蓝白外观是可视化示意。',
    sourceUrl: 'https://academic.oup.com/mnras/article/447/3/2459/988608',
    sourceLabel: 'MNRAS · M31 高光度蓝变星研究', appearance: '冷蓝外缘与高亮白色星面',
  }),
  star({
    id: 'ae-and', cn: '仙女座 AE', en: 'AE ANDROMEDAE', index: 'AE',
    type: '仙女座星系 / 高光度蓝变星', parentGalaxy: 'andromeda',
    position: [234100, 34740, -177000], r: 20, surfaceStyle: 'blue-star', color: 0xa7dcff,
    diameter: 'M31', stat1: '所在星系', stat2: '恒星类型', value2: '蓝变星',
    desc: 'AE And 是仙女座星系的一颗高光度蓝变星。观测者利用它在不同状态下的光谱研究炽热大气与物质流失，揭示大质量恒星复杂的生命历程。',
    sourceUrl: 'https://academic.oup.com/mnras/article/447/3/2459/988608',
    sourceLabel: 'MNRAS · AE And 光谱研究', appearance: '淡青色星面与细密流动光斑',
  }),
  star({
    id: 'romano-star', cn: '罗马诺之星', en: "ROMANO’S STAR · GR 290", index: 'GR 290',
    type: '三角座星系 / 演化中的大质量恒星', parentGalaxy: 'triangulum',
    position: [-216400, -17500, -207100], r: 24, surfaceStyle: 'blue-star', color: 0x8ce9ff,
    diameter: 'M33', stat1: '所在星系', stat2: '另一编号', value2: 'V532',
    desc: '也称 GR 290 或 V532。它在三角座星系中呈现明显的亮度和光谱变化，某些状态具有晚型氮序沃尔夫–拉叶星的特征，让我们得以研究大质量恒星的演化。',
    sourceUrl: 'https://academic.oup.com/mnras/article/419/2/1455/989195',
    sourceLabel: 'MNRAS · 罗马诺之星光谱模型', appearance: '明亮青白星面与蓝色恒星风光晕',
  }),
  star({
    id: 'r136a1', cn: 'R136a1', en: 'R136a1', index: 'R136',
    type: '大麦哲伦星云 / 大质量恒星', parentGalaxy: 'lmc',
    position: [105600, -64750, 77200], r: 28, surfaceStyle: 'blue-star', color: 0xb0d8ff,
    diameter: '逾 100', stat1: '质量量级', unit1: '太阳质量',
    stat2: '所在星团', value2: 'R136',
    desc: '位于蜘蛛星云的 R136 星团，是已知极大质量恒星的代表。它释放强烈的辐射与恒星风；质量估计随观测和模型修订，这里展示量级而非固定排名。',
    sourceUrl: 'https://www.eso.org/public/news/eso1030/',
    sourceLabel: 'ESO · R136 大质量恒星研究', appearance: '炽白核心、冰蓝光晕与细密能量纹理',
  }),
  star({
    id: 'woh-g64', cn: 'WOH G64', en: 'WOH G64', index: 'WOH',
    type: '大麦哲伦星云 / 演化中的超巨星', parentGalaxy: 'lmc',
    position: [94800, -65170, 81700], r: 35, surfaceStyle: 'red-star', color: 0xffb273,
    diameter: 'LMC', stat1: '所在星系', stat2: '周围物质', value2: '浓厚尘埃',
    desc: '被厚重尘埃包围的著名超巨星。近期研究对它是否已由红超巨星转为黄特超巨星存在不同解释；这里以暖色艺术模型呈现，不把演化阶段或当前颜色视为定论。',
    sourceUrl: 'https://arxiv.org/abs/2601.02057',
    sourceLabel: 'van Loon 与 Ohnaka · 2026 光谱研究', appearance: '巨大的暖橙星面与柔和尘埃色光晕',
  }),
  star({
    id: 'hd5980', cn: 'HD 5980', en: 'HD 5980', index: 'HD',
    type: '小麦哲伦星云 / 大质量多星系统', parentGalaxy: 'smc',
    position: [165100, -94820, 108600], r: 26, surfaceStyle: 'blue-star', color: 0xbfceff,
    diameter: 'SMC', stat1: '所在星系', stat2: '观测特征', value2: '强烈恒星风',
    desc: 'NGC 346 附近的著名大质量多星系统，包含沃尔夫–拉叶型恒星，并曾经历显著爆发。此处用一个发光天体代表整个系统，方便探索；不是各成员的真实空间结构。',
    sourceUrl: 'https://ntrs.nasa.gov/citations/19950037141',
    sourceLabel: 'NASA NTRS · HD 5980 多星系统研究', appearance: '蓝紫边缘与强烈白色辉光',
  }),
];

function planet(definition) {
  const host = stars.find((body) => body.id === definition.parentStarId);
  const angle = definition.phase;
  return {
    kind: 'planet', parentGalaxy: host.parentGalaxy, parentId: host.id,
    position: [
      host.position[0] + Math.cos(angle) * definition.orbitRadius,
      host.position[1],
      host.position[2] + Math.sin(angle) * definition.orbitRadius,
    ],
    unit1: '', unit2: '', surfaceStyle: 'gas-giant',
    ...definition,
  };
}

const confirmedPlanets = [
  planet({
    id: 'hr8799-b', parentStarId: 'hr8799', cn: 'HR 8799 b', en: 'HR 8799 b', index: 'b',
    type: '银河系 / 已确认气态巨行星', modelStatus: 'confirmed',
    r: 3.5, orbitRadius: 90, orbitalPeriod: 160, phase: 0.7, color: 0xe5af8b,
    diameter: '约 7', stat1: '质量估计', unit1: '木星质量',
    stat2: '公转周期', value2: '约 465.8', unit2: '年',
    desc: 'HR 8799 系统最外侧的已知行星，通过直接成像被发现。NASA 目录给出约 7 个木星质量的估计；画面中的暖色云带、比例与运行速度为艺术演示。',
    sourceUrl: 'https://science.nasa.gov/exoplanet-catalog/hr-8799-b/',
    sourceLabel: 'NASA 系外行星目录 · HR 8799 b', appearance: '琥珀色宽云带与乳白风暴',
  }),
  planet({
    id: 'hr8799-c', parentStarId: 'hr8799', cn: 'HR 8799 c', en: 'HR 8799 c', index: 'c',
    type: '银河系 / 已确认气态巨行星', modelStatus: 'confirmed',
    r: 3.8, orbitRadius: 75, orbitalPeriod: 125, phase: 2.3, color: 0xd8906e,
    diameter: '约 10', stat1: '质量估计', unit1: '木星质量',
    stat2: '公转周期', value2: '约 189', unit2: '年',
    desc: '这颗巨行星位于 HR 8799 b 轨道内侧，2008 年公布发现。NASA 目录给出约 10 个木星质量的估计；棕红云层是依据巨行星特征绘制的艺术表面。',
    sourceUrl: 'https://science.nasa.gov/exoplanet-catalog/hr-8799-c/',
    sourceLabel: 'NASA 系外行星目录 · HR 8799 c', appearance: '棕红云带与金色涡旋',
  }),
  planet({
    id: 'hr8799-d', parentStarId: 'hr8799', cn: 'HR 8799 d', en: 'HR 8799 d', index: 'd',
    type: '银河系 / 已确认气态巨行星', modelStatus: 'confirmed',
    r: 3.7, orbitRadius: 60, orbitalPeriod: 95, phase: 4.1, color: 0xc4a7d9,
    diameter: '约 10', stat1: '质量估计', unit1: '木星质量',
    stat2: '公转周期', value2: '约 101.4', unit2: '年',
    desc: '四颗已知巨行星中的内侧成员之一，也在 2008 年公布发现。它绕恒星一周需要约一个世纪；这里加快时间，让遥远的公转在眼前展开。紫灰色纹理为艺术示意。',
    sourceUrl: 'https://science.nasa.gov/exoplanet-catalog/hr-8799-d/',
    sourceLabel: 'NASA 系外行星目录 · HR 8799 d', appearance: '紫灰条带与淡粉风暴云层',
  }),
  planet({
    id: 'hr8799-e', parentStarId: 'hr8799', cn: 'HR 8799 e', en: 'HR 8799 e', index: 'e',
    type: '银河系 / 已确认气态巨行星', modelStatus: 'confirmed',
    r: 3.6, orbitRadius: 45, orbitalPeriod: 65, phase: 5.5, color: 0xe4c88e,
    diameter: '约 10', stat1: '质量估计', unit1: '木星质量',
    stat2: '公转周期', value2: '约 57', unit2: '年',
    desc: '2010 年公布发现，是 HR 8799 四颗已知行星中最靠近恒星的一颗。它是一颗可直接成像研究的巨大世界；画面中的金色云带与风暴形态为艺术演绎。',
    sourceUrl: 'https://science.nasa.gov/exoplanet-catalog/hr-8799-e/',
    sourceLabel: 'NASA 系外行星目录 · HR 8799 e', appearance: '金色厚云层与深褐旋涡',
  }),
];

// These four destinations are explicitly fictional. Their placement beside known
// stars does not claim a detected companion, a viable orbit or observed weather.
const illustrativePlanets = [
  planet({
    id: 'andromeda-giant-demo', parentStarId: 'af-and', cn: '仙女巨行星·示意', en: 'ANDROMEDA GIANT · ILLUSTRATION', index: 'SIM',
    type: '仙女座星系 / 虚构巨行星示意', modelStatus: 'illustration',
    r: 4.2, orbitRadius: 176, orbitalPeriod: 120, phase: 0.9, color: 0x89bddd,
    diameter: '艺术示意', stat1: '天体状态', stat2: '观测确认', value2: '未确认',
    desc: '为星系漫游创作的虚构巨行星，蓝色云带与风暴均为艺术设计。画面借 AF And 作为导航邻居，不代表已在这颗恒星周围发现行星，也不代表真实轨道。',
    sourceUrl: 'https://academic.oup.com/mnras/article/447/3/2459/988608',
    sourceLabel: '恒星背景资料 · 此行星为虚构示意', appearance: '蓝银云带与深海蓝风暴',
  }),
  planet({
    id: 'triangulum-giant-demo', parentStarId: 'romano-star', cn: '三角巨行星·示意', en: 'TRIANGULUM GIANT · ILLUSTRATION', index: 'SIM',
    type: '三角座星系 / 虚构巨行星示意', modelStatus: 'illustration',
    r: 3.9, orbitRadius: 192, orbitalPeriod: 145, phase: 2.7, color: 0x77d3c5,
    diameter: '艺术示意', stat1: '天体状态', stat2: '观测确认', value2: '未确认',
    desc: '在三角座星系场景中加入的虚构巨行星，青绿色大气是艺术想象。它在罗马诺之星旁的运行仅为演示，不是已确认的行星发现或真实恒星系统。',
    sourceUrl: 'https://academic.oup.com/mnras/article/419/2/1455/989195',
    sourceLabel: '恒星背景资料 · 此行星为虚构示意', appearance: '青绿条带与白色长风暴',
  }),
  planet({
    id: 'lmc-giant-demo', parentStarId: 'r136a1', cn: '麦哲伦巨行星·示意', en: 'MAGELLANIC GIANT · ILLUSTRATION', index: 'SIM',
    type: '大麦哲伦星云 / 虚构巨行星示意', modelStatus: 'illustration',
    r: 4.4, orbitRadius: 224, orbitalPeriod: 155, phase: 4.2, color: 0xe4adcf,
    diameter: '艺术示意', stat1: '天体状态', stat2: '观测确认', value2: '未确认',
    desc: '玫瑰色云带构成一颗为漫游创作的虚构巨行星。它与 R136a1 的位置关系仅为导航和视觉演示，不表示存在已发现的行星，也不模拟真实辐射环境。',
    sourceUrl: 'https://www.eso.org/public/news/eso1030/',
    sourceLabel: '恒星背景资料 · 此行星为虚构示意', appearance: '玫瑰色云层与浅金色风暴带',
  }),
  planet({
    id: 'smc-giant-demo', parentStarId: 'hd5980', cn: '小麦哲伦巨行星·示意', en: 'SMC GIANT · ILLUSTRATION', index: 'SIM',
    type: '小麦哲伦星云 / 虚构巨行星示意', modelStatus: 'illustration',
    r: 3.4, orbitRadius: 208, orbitalPeriod: 135, phase: 5.1, color: 0xa4ace9,
    surfaceStyle: 'ice-giant', diameter: '艺术示意', stat1: '天体状态',
    stat2: '观测确认', value2: '未确认',
    desc: '为小麦哲伦星云场景设计的虚构巨行星，冰蓝外观与环流是艺术想象。它围绕 HD 5980 图标的运动仅作展示，不代表这座多星系统中已探测到行星。',
    sourceUrl: 'https://ntrs.nasa.gov/citations/19950037141',
    sourceLabel: '恒星背景资料 · 此行星为虚构示意', appearance: '冰蓝薄云与柔和紫色纬向纹理',
  }),
];

const deepSpaceBodyDefinitions = [...stars, ...confirmedPlanets, ...illustrativePlanets];

export { galaxyDefinitions, localGroupDefinition, deepSpaceBodyDefinitions };
