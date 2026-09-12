# 已观测星系扩展资料

核对日期：2026-09-12。数据定义：`src/universe/observed-galaxies.js`。

这六座星系均已被天文望远镜观测，均在本星系群之外。`parentId: 'local-group'` 仅沿用应用的星系图鉴容器 ID，不表示真实的星系群归属。场景坐标、半径、倾斜角、颜色和粒子分布均为便于漫游的艺术示意；面板中的距离采用对应官方来源的近似值，不用于驱动场景坐标。未为这些星系虚构可探索恒星、行星或成员系统。

| 对象 | 面板采用的稳定事实 | 官方来源 |
| --- | --- | --- |
| 旋涡星系 M51 | 猎犬座方向的螺旋星系，距地球约 3100 万光年；旋臂包含恒星形成区，NGC 5195 的近距离相互作用可能增强旋臂结构。 | [NASA Hubble · Messier 51](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-51/) |
| 波德星系 M81 | 大熊座方向的螺旋星系，距地球约 1160 万光年；年轻蓝星形成旋臂，较老偏红恒星聚集在中央核球。 | [NASA Hubble · Messier 81](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-81/) |
| 雪茄星系 M82 | 大熊座方向，距地球约 1200 万光年；与 M81 的引力相互作用促进剧烈恒星形成，年轻恒星驱动星系风。NASA 目录将其形态列为螺旋星系，星暴描述活动状态。 | [NASA Hubble · Messier 82](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-82/) |
| 草帽星系 M104 | 近乎侧视，明亮核球外有显著尘带；距地球约 3000 万光年。NASA Hubble 目录采用螺旋星系分类。 | [NASA Webb · Sombrero Galaxy’s Disk](https://science.nasa.gov/missions/webb/nasas-webb-rounds-out-picture-of-sombrero-galaxys-disk/)、[NASA Hubble · Messier 104](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-104/) |
| 半人马座 A / NGC 5128 | 半人马座方向的特殊大质量椭圆星系，距地球约 1200 万光年；强射电辐射及穿过星光的宽尘带十分突出，尘埃、气体与年轻恒星支持星系合并解释。 | [ESO · A Deeper Look at Centaurus A](https://www.hq.eso.org/public/news/eso1221/) |
| M87 | 室女座星系团的巨大椭圆星系，距地球约 5400 万光年；具有众多球状星团，中央黑洞活动产生高速喷流。 | [NASA Hubble · Messier 87](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-87/) |

## 距离与外观口径

- M81 有官方科普页面四舍五入为 1200 万光年；此处与所链接哈勃目录的 1160 万保持一致。
- M104 的哈勃目录采用 2800 万光年，所链接韦布专题采用约 3000 万光年；此处采用后者的近似口径。`profile: 'lenticular'` 控制草帽轮廓，不单独断言透镜星系分类。
- 半人马座 A 的不同官方介绍可见约 1100 万至 1300 万光年；此处采用所链接 ESO 深度观测的约 1200 万。
- M87 的 EHT 资料常写约 5500 万光年；此处采用所链接 NASA 哈勃目录的约 5400 万。
- M82 的 `shape: 'irregular'` 仅选择受扰动星光的渲染分布，`profile: 'cigar'` 表现狭长侧视盘和外流。用户可见分类为星暴星系，说明文字明确其螺旋形态。
- 所有喷流、尘带、恒星形成区与粒子星光都是对观测特征的示意，场景中的每个发光粒子不对应一颗单独确认的恒星。
