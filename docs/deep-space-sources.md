# 深空目录与资料来源

核对日期：2026-09-08。目录文件：`src/universe/deep-space-catalog.js`。

本次增加 M32、M110 / NGC 205 和巴纳德星系 / NGC 6822 三座邻近星系，连同原有银河、仙女座、三角座和大小麦哲伦星云，共开放八座星系。本次另增加八颗真实恒星与五个黑洞目的地；深空目录现在共有十六个真实恒星或恒星系统、五个黑洞、四颗已确认的银河系巨行星，以及原有四颗明确标注的虚构巨行星。原有太阳不计入这十六个深空恒星节点。

## 事实与画面之间的界限

- `modelStatus: confirmed` 仅表示天体或系统真实存在，不表示纹理、配色、大小、位置或运行轨道来自实测影像。
- `modelStatus: illustration` 的四颗行星在中文名称、类型及介绍中均注明“示意”或“虚构”。它们不是候选发现，也不是已确认的河外行星。其 `sourceUrl` 提供背景恒星资料，`sourceLabel` 明确说明不能用该来源证明行星存在。
- 四颗虚构行星分别放在 AF And、罗马诺之星、R136a1、HD 5980 的展示节点附近，供飞行和导航使用；这种配对不构成科学上的宿主关系或稳定轨道声明。
- HR 8799 b、c、d、e 是真实的已确认气态巨行星。目录质量和公转周期采用下面 NASA 面向公众目录的近似值，不混用不同研究模型。质量估计并非精确测量值，后续文献可能给出不同估计。
- 全部 `position` 为绝对场景坐标，`r`、`radius`、`viewDistance`、`orbitRadius`、`orbitalPeriod` 和 `phase` 均为展示参数。动画周期以演示秒计，和面板中显示的真实公转年数无换算关系。
- 星系之间的距离、方向、倾角、旋臂数量和天体内部位置均作了构图调整；本版不是天体测量星图。八座星系是开放目的地数量，不是本星系群的成员总数，也不是按实测距离排序的“最近八座”。本星系群面板的开放数量由 `galaxyDefinitions.length + 1` 动态生成。
- 恒星与行星纹理均为程序化艺术表面。恒星半径压缩在 4.5–35 个场景单位，巨行星在 3.4–4.4 个单位；视觉尺寸不可用来比较真实直径或质量。
- HD 5980 是多星系统，此处以单个发光物体代表整个系统，不是把它科学上归为单星。
- 南门二 A、B、比邻星和天狼星 A、B 分别提供单独目的地。两组系统的成员间距经放大，当前节点不模拟真实双星或三星轨道；本次没有为新增恒星附加行星。
- 黑洞的 `modelStatus: confirmed` 指天体的存在；黑色阴影、吸积盘颜色、亮环、倾角与动态纹理均为概念演示，不是光学照片或广义相对论光线追踪结果，也不宣称五个黑洞都具有同样的活跃吸积状态。显示半径 18–45 个单位经过独立压缩，不能据此比较黑洞质量。
- `diskOuterRadius` 是黑洞显示半径 `r` 的倍数，`visualRadius = r * diskOuterRadius` 用于容纳整个显示盘，`diskTilt` 是 XYZ 欧拉角（弧度）。这些数值均为场景参数。
- 人马座 A*、M31 和 M32 黑洞放在各自星系的场景中心；M33 X-7 和 LMC X-1 是星系内的恒星级双星黑洞，位置避开核区，`parentGalaxy` / `parentId` 只记录所在星系，不表示位于星系中心。没有为 M110、小麦哲伦星云或 NGC 6822 凭空配置中央黑洞。

## 星系来源

| 对象 | 采用的事实 | 一手来源 |
| --- | --- | --- |
| 本星系群 | 银河、M31、M33 等属于同一个邻近星系群 | [NASA Imagine the Universe — Local Group](https://imagine.gsfc.nasa.gov/features/cosmic/local_group_info.html) |
| 仙女座 M31 | 邻近大型螺旋星系，距离约 250 万光年 | [NASA/JPL — Andromeda](https://www.jpl.nasa.gov/images/pia15416-andromeda/) |
| 三角座 M33 | 螺旋星系，距离约 300 万光年，本星系群主要成员 | [NASA — The Triangulum Galaxy](https://www.nasa.gov/image-article/triangulum-galaxy-3/)，[NASA Hubble — Messier 33](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-33/) |
| 大麦哲伦星云 | 不规则矮星系，距离约 16 万光年 | [NASA Earth Observatory — The Galaxy Next Door](https://science.nasa.gov/earth/earth-observatory/the-galaxy-next-door/) |
| 小麦哲伦星云 | 银河附近的矮星系，距离约 20 万光年 | [NASA — Little Galaxy Explored](https://science.nasa.gov/photojournal/little-galaxy-explored/)，[NASA — Nearby Massive Star Cluster](https://science.nasa.gov/missions/hubble/nearby-massive-star-cluster-yields-insights-into-early-universe/) |
| M32 | 仙女座的紧凑椭圆卫星星系，距离约 250 万光年；采用集中、平滑的暖色椭圆模型 | [NASA Hubble — Messier 32](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-32/) |
| M110 / NGC 205 | 仙女座的矮椭圆卫星星系，本星系群成员，距离约 270 万光年；中心有年轻蓝星的证据 | [NASA Hubble — Messier 110](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-110/)，[NASA — M110: Satellite of the Andromeda Galaxy](https://science.nasa.gov/image-article/apod-2008-september-9-m110-satellite-of-the-andromeda-galaxy/) |
| 巴纳德星系 / NGC 6822 | 距离约 160 万光年的本星系群不规则矮星系，恒星重元素含量较低，可研究邻近低金属丰度环境 | [ESA Euclid — Euclid’s view of irregular galaxy NGC 6822](https://www.esa.int/Science_Exploration/Space_Science/Euclid/Euclid_s_view_of_irregular_galaxy_NGC_6822) |

## 恒星来源

| 对象 | 采用的事实与处理方式 | 一手来源 |
| --- | --- | --- |
| 比邻星 | 距离约 4.25 光年、除太阳外最近的恒星；南门二系统的红矮星成员，存在强烈耀斑 | [NASA — Our Nearest Celestial Neighbor? An Exotic 3-Star System](https://science.nasa.gov/exoplanets/other-stars-other-worlds/our-nearest-celestial-neighbor-an-exotic-3-star-system/) |
| 南门二 A | 近邻三星系统中类似太阳的成员，与 B 互相绕行；比邻星是远方成员 | [NASA Chandra — Alpha Centauri: A Triple Star System about 4 Light Years from Earth](https://www.nasa.gov/image-article/alpha-centauri-triple-star-system-about-4-light-years-from-earth/) |
| 南门二 B | 橙色恒星，比太阳稍冷且质量稍小；通过星震研究内部性质 | [ESO — Allo, Allo? A Star is Ringing](https://www.hq.eso.org/public/news/eso0542/) |
| 天狼星 A | 地球夜空中最亮的恒星，距地球约 8.6 光年，与 B 构成约 50 年周期的双星 | [NASA Hubble — The Dog Star, Sirius, and its Tiny Companion](https://science.nasa.gov/asset/hubble/the-dog-star-sirius-and-its-tiny-companion/) |
| 天狼星 B | 距地球约 8.6 光年；大小接近地球、质量接近太阳的白矮星 | [NASA Hubble — Measuring a White Dwarf Star](https://science.nasa.gov/missions/hubble/measuring-a-white-dwarf-star/) |
| 织女星 | 天琴座亮星，夏季大三角成员，距地球约 25 光年，周围存在观测到的碎屑尘埃盘；本版只建恒星节点 | [NASA Hubble / Webb — Observations of Vega Circumstellar Disk](https://science.nasa.gov/asset/hubble/hubble-and-webb-observations-of-vega-circumstellar-disk/)，[NASA — Summer Triangle Corner: Vega](https://science.nasa.gov/solar-system/skywatching/night-sky-network/summer-triangle-corner-vega/) |
| 北河三 | 双子座巨星，距离约 34 光年；与北河二无引力束缚双星关系，橙色模型对应 K 型巨星 | [NASA — Find the Twins: Gemini Constellation](https://science.nasa.gov/solar-system/skywatching/night-sky-network/gemini-constellation/)，[Kelch et al. 1978, NASA GISS — Pollux (K0 III)](https://www.giss.nasa.gov/pubs/abs/ke02100q.html) |
| 参宿七 | 猎户座的蓝超巨星，与参宿四呈不同颜色；未将不确定的直径或距离估计写死 | [NASA — The Lives, Times, and Deaths of Stars](https://science.nasa.gov/universe/stories/quick-reads/the-lives-times-and-deaths-of-stars/)，[NASA — Find the Twins: Gemini Constellation](https://science.nasa.gov/solar-system/skywatching/night-sky-network/gemini-constellation/) |
| 参宿四 | 猎户座红超巨星，直径约千个太阳直径的量级；实际半径随测量方法、距离假设和变化状态而异 | [ESA — Betelgeuse braces for a collision](https://www.esa.int/Science_Exploration/Space_Science/Betelgeuse_braces_for_a_collision) |
| HR 8799 | 四颗已确认巨行星 b、c、d、e 的宿主，行星有直接成像研究 | [NASA Exoplanet Archive — HR 8799](https://exoplanetarchive.ipac.caltech.edu/overview/HR%208799) |
| AF And 与 AE And | 仙女座星系中已知的高光度蓝变星；不设置未经核对的直径或亮度排名 | [Sholukhova et al. 2015, MNRAS — New luminous blue variables in the Andromeda galaxy](https://academic.oup.com/mnras/article/447/3/2459/988608) |
| 罗马诺之星 | M33 中的 GR 290 / V532，大质量演化恒星，不同光谱状态具有晚型氮序沃尔夫–拉叶星特征 | [Maryeva & Abolmasov 2012, MNRAS — Modelling the optical spectrum of Romano’s star](https://academic.oup.com/mnras/article/419/2/1455/989195) |
| R136a1 | 位于大麦哲伦星云蜘蛛星云中的 R136 星团，是百太阳质量量级恒星的代表 | [ESO — Stars Just Got Bigger](https://www.eso.org/public/news/eso1030/)；目录只用“逾 100 太阳质量”量级，不沿用该 2010 年新闻的精确质量或“最大”排名 |
| WOH G64 | 大麦哲伦星云中受尘埃包围、近期发生显著变化的超巨星；现阶段解释存在争议，目录用中性的“演化中的超巨星” | [Ohnaka et al. 2024 — Imaging the innermost circumstellar environment](https://www.eso.org/public/archives/releases/sciencepapers/eso2417/eso2417a.pdf)，[Muñoz-Sanchez et al. 2026, Nature Astronomy — Transition to a yellow hypergiant](https://www.nature.com/articles/s41550-026-02789-7)，[van Loon & Ohnaka 2026 — WOH G64 is still a red supergiant, for now](https://arxiv.org/abs/2601.02057) |
| HD 5980 | 小麦哲伦星云的沃尔夫–拉叶多星系统，存在显著变化、强烈恒星风；位于 NGC 346 附近，曾在 1994 年爆发 | [Koenigsberger et al. 1994, NASA NTRS — Remarkable long-term changes](https://ntrs.nasa.gov/citations/19950037141)，[Nazé et al. 2002, ApJ — X-ray investigation of the NGC 346 field](https://asd.gsfc.nasa.gov/Michael.Corcoran/papers/2002ApJ_580_225.pdf) |

WOH G64 的红色画面属于艺术外观，不裁决相互竞争的光谱解释。2026 年的 Nature Astronomy 论文与 van Loon / Ohnaka 论文是两个不同团队的不同解释，不能把后者的 arXiv 链接误标为前者预印本。

## 黑洞来源

| 对象 | 采用的事实与处理方式 | 一手来源 |
| --- | --- | --- |
| 人马座 A* | 银河系中央超大质量黑洞，约 400 万太阳质量；EHT 于 2022 年公布首张阴影图像 | [ESO / EHT — Astronomers reveal first image of the black hole at the heart of our galaxy](https://www.hq.eso.org/public/news/eso2208-eht-mw/) |
| 仙女座中央黑洞 / M31* | M31 中央超大质量黑洞；采用 Hubble 研究约 1.4 亿太阳质量的估计，非精确不变数值 | [NASA Hubble — Our Neighboring Galaxy’s Unusual Core](https://science.nasa.gov/asset/hubble/our-neighboring-galaxys-unusual-core/) |
| M32 中央黑洞 / M32* | 位于 M32 中央，采用 NASA 尺度比较的“逾 200 万太阳质量”量级，不沿用早期新闻的精确数值 | [NASA SVS — Supermassive Black Hole Scale Comparison, 00:40](https://svs.gsfc.nasa.gov/vis/a010000/a014300/a014335/14335_Supermassive_Black_Hole_Scale_Comparison_HTML_Transcript.html)，[NASA Hubble — The Dense Nucleus of Galaxy M32](https://science.nasa.gov/missions/hubble/nasas-hubble-space-telescope-images-the-dense-nucleus-of-galaxy-m32/) |
| M33 X-7 | 三角座星系内食双星的恒星级黑洞；Orosz 等给出 15.65 ± 1.45 太阳质量，面板取约 16，不是星系中央黑洞 | [Orosz et al. 2007, Nature — A 15.65 solar mass black hole in an eclipsing binary in the nearby spiral galaxy Messier 33](https://arxiv.org/abs/0710.3165)，[NASA Chandra — M33 X-7](https://chandra.harvard.edu/photo/2007/m33x7/) |
| LMC X-1 | 大麦哲伦星云的高质量 X 射线双星，黑洞动力学质量 10.91 ± 1.41 太阳质量，面板取约 11，不是星系中央黑洞 | [Orosz et al. 2009, ApJ — A New Dynamical Model for the Black Hole Binary LMC X-1](https://arxiv.org/abs/0810.3447) |

## 已确认巨行星

| 对象 | 本版采用的 NASA 目录近似质量 | 真实公转周期 | 一手目录 |
| --- | --- | --- | --- |
| HR 8799 b | 7 木星质量 | 465.8 年 | [NASA — HR 8799 b](https://science.nasa.gov/exoplanet-catalog/hr-8799-b/) |
| HR 8799 c | 10 木星质量 | 189 年 | [NASA — HR 8799 c](https://science.nasa.gov/exoplanet-catalog/hr-8799-c/) |
| HR 8799 d | 10 木星质量 | 101.4 年 | [NASA — HR 8799 d](https://science.nasa.gov/exoplanet-catalog/hr-8799-d/) |
| HR 8799 e | 10 木星质量 | 57 年 | [NASA — HR 8799 e](https://science.nasa.gov/exoplanet-catalog/hr-8799-e/) |

外部星系的四个行星目的地全部是虚构示意；本版没有将任何河外微引力透镜候选加入已确认目录。未来新增候选时应独立使用 `modelStatus: candidate`，提供对应观测论文，并避免将候选天体配置到无关联的著名恒星上。
