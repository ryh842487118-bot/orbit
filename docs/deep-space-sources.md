# 深空目录与资料来源

核对日期：2026-09-07。目录文件：`src/universe/deep-space-catalog.js`。

本版保留原有银河系，增加仙女座、三角座、大小麦哲伦星云，共开放五座星系。新增天体为八个真实恒星或恒星系统、四颗已确认的银河系巨行星，以及四颗明确标注的虚构巨行星。

## 事实与画面之间的界限

- `modelStatus: confirmed` 仅表示天体或系统真实存在，不表示纹理、配色、大小、位置或运行轨道来自实测影像。
- `modelStatus: illustration` 的四颗行星在中文名称、类型及介绍中均注明“示意”或“虚构”。它们不是候选发现，也不是已确认的河外行星。其 `sourceUrl` 提供背景恒星资料，`sourceLabel` 明确说明不能用该来源证明行星存在。
- 四颗虚构行星分别放在 AF And、罗马诺之星、R136a1、HD 5980 的展示节点附近，供飞行和导航使用；这种配对不构成科学上的宿主关系或稳定轨道声明。
- HR 8799 b、c、d、e 是真实的已确认气态巨行星。目录质量和公转周期采用下面 NASA 面向公众目录的近似值，不混用不同研究模型。质量估计并非精确测量值，后续文献可能给出不同估计。
- 全部 `position` 为绝对场景坐标，`r`、`radius`、`viewDistance`、`orbitRadius`、`orbitalPeriod` 和 `phase` 均为展示参数。动画周期以演示秒计，和面板中显示的真实公转年数无换算关系。
- 星系之间的距离、方向、倾角、旋臂数量和天体内部位置均作了构图调整；本版不是天体测量星图。五座星系是开放目的地数量，不是本星系群的成员总数。
- 恒星与行星纹理均为程序化艺术表面。恒星半径压缩在 9–35 个场景单位，巨行星在 3.4–4.4 个单位；视觉尺寸不可用来比较真实直径或质量。
- HD 5980 是多星系统，此处以单个发光物体代表整个系统，不是把它科学上归为单星。

## 星系来源

| 对象 | 采用的事实 | 一手来源 |
| --- | --- | --- |
| 本星系群 | 银河、M31、M33 等属于同一个邻近星系群 | [NASA Imagine the Universe — Local Group](https://imagine.gsfc.nasa.gov/features/cosmic/local_group_info.html) |
| 仙女座 M31 | 邻近大型螺旋星系，距离约 250 万光年 | [NASA/JPL — Andromeda](https://www.jpl.nasa.gov/images/pia15416-andromeda/) |
| 三角座 M33 | 螺旋星系，距离约 300 万光年，本星系群主要成员 | [NASA — The Triangulum Galaxy](https://www.nasa.gov/image-article/triangulum-galaxy-3/)，[NASA Hubble — Messier 33](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-33/) |
| 大麦哲伦星云 | 不规则矮星系，距离约 16 万光年 | [NASA Earth Observatory — The Galaxy Next Door](https://science.nasa.gov/earth/earth-observatory/the-galaxy-next-door/) |
| 小麦哲伦星云 | 银河附近的矮星系，距离约 20 万光年 | [NASA — Little Galaxy Explored](https://science.nasa.gov/photojournal/little-galaxy-explored/)，[NASA — Nearby Massive Star Cluster](https://science.nasa.gov/missions/hubble/nearby-massive-star-cluster-yields-insights-into-early-universe/) |

## 恒星来源

| 对象 | 采用的事实与处理方式 | 一手来源 |
| --- | --- | --- |
| 参宿四 | 猎户座红超巨星，直径约千个太阳直径的量级；实际半径随测量方法、距离假设和变化状态而异 | [ESA — Betelgeuse braces for a collision](https://www.esa.int/Science_Exploration/Space_Science/Betelgeuse_braces_for_a_collision) |
| HR 8799 | 四颗已确认巨行星 b、c、d、e 的宿主，行星有直接成像研究 | [NASA Exoplanet Archive — HR 8799](https://exoplanetarchive.ipac.caltech.edu/overview/HR%208799) |
| AF And 与 AE And | 仙女座星系中已知的高光度蓝变星；不设置未经核对的直径或亮度排名 | [Sholukhova et al. 2015, MNRAS — New luminous blue variables in the Andromeda galaxy](https://academic.oup.com/mnras/article/447/3/2459/988608) |
| 罗马诺之星 | M33 中的 GR 290 / V532，大质量演化恒星，不同光谱状态具有晚型氮序沃尔夫–拉叶星特征 | [Maryeva & Abolmasov 2012, MNRAS — Modelling the optical spectrum of Romano’s star](https://academic.oup.com/mnras/article/419/2/1455/989195) |
| R136a1 | 位于大麦哲伦星云蜘蛛星云中的 R136 星团，是百太阳质量量级恒星的代表 | [ESO — Stars Just Got Bigger](https://www.eso.org/public/news/eso1030/)；目录只用“逾 100 太阳质量”量级，不沿用该 2010 年新闻的精确质量或“最大”排名 |
| WOH G64 | 大麦哲伦星云中受尘埃包围、近期发生显著变化的超巨星；现阶段解释存在争议，目录用中性的“演化中的超巨星” | [Ohnaka et al. 2024 — Imaging the innermost circumstellar environment](https://www.eso.org/public/archives/releases/sciencepapers/eso2417/eso2417a.pdf)，[Muñoz-Sanchez et al. 2026, Nature Astronomy — Transition to a yellow hypergiant](https://www.nature.com/articles/s41550-026-02789-7)，[van Loon & Ohnaka 2026 — WOH G64 is still a red supergiant, for now](https://arxiv.org/abs/2601.02057) |
| HD 5980 | 小麦哲伦星云的沃尔夫–拉叶多星系统，存在显著变化、强烈恒星风；位于 NGC 346 附近，曾在 1994 年爆发 | [Koenigsberger et al. 1994, NASA NTRS — Remarkable long-term changes](https://ntrs.nasa.gov/citations/19950037141)，[Nazé et al. 2002, ApJ — X-ray investigation of the NGC 346 field](https://asd.gsfc.nasa.gov/Michael.Corcoran/papers/2002ApJ_580_225.pdf) |

WOH G64 的红色画面属于艺术外观，不裁决相互竞争的光谱解释。2026 年的 Nature Astronomy 论文与 van Loon / Ohnaka 论文是两个不同团队的不同解释，不能把后者的 arXiv 链接误标为前者预印本。

## 已确认巨行星

| 对象 | 本版采用的 NASA 目录近似质量 | 真实公转周期 | 一手目录 |
| --- | --- | --- | --- |
| HR 8799 b | 7 木星质量 | 465.8 年 | [NASA — HR 8799 b](https://science.nasa.gov/exoplanet-catalog/hr-8799-b/) |
| HR 8799 c | 10 木星质量 | 189 年 | [NASA — HR 8799 c](https://science.nasa.gov/exoplanet-catalog/hr-8799-c/) |
| HR 8799 d | 10 木星质量 | 101.4 年 | [NASA — HR 8799 d](https://science.nasa.gov/exoplanet-catalog/hr-8799-d/) |
| HR 8799 e | 10 木星质量 | 57 年 | [NASA — HR 8799 e](https://science.nasa.gov/exoplanet-catalog/hr-8799-e/) |

外部星系的四个行星目的地全部是虚构示意；本版没有将任何河外微引力透镜候选加入已确认目录。未来新增候选时应独立使用 `modelStatus: candidate`，提供对应观测论文，并避免将候选天体配置到无关联的著名恒星上。
