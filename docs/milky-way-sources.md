# 银河系新增行星

核对日期：2026-09-12。目录位于 `src/universe/deep-space-catalog.js`。

新增六颗行星均为已确认天体；`modelStatus: confirmed` 只表示天体已确认，不表示画面中的地貌、大气或颜色得到观测确认。下表半径、公转周期采用核对时 NASA 系外行星目录的展示值。场景中的 `r`、`orbitRadius`、`orbitalPeriod`、坐标和相位是交互构图参数，不是物理比例或星历。

| 行星 | 母星 | 面板采用的资料 | 原始资料 |
| --- | --- | --- | --- |
| 比邻星 b | 比邻星（既有目录） | 2016 年公布发现；径向速度法；公转约 11.2 天 | [NASA · Proxima Centauri b](https://science.nasa.gov/exoplanet-catalog/proxima-centauri-b/) |
| TRAPPIST-1 e | TRAPPIST-1 | 半径 0.92 个地球半径；公转约 6.1 天 | [NASA · TRAPPIST-1 e](https://science.nasa.gov/exoplanet-catalog/trappist-1-e/) |
| TRAPPIST-1 f | TRAPPIST-1 | 半径约 1.05 个地球半径；公转约 9.2 天 | [NASA · TRAPPIST-1 f](https://science.nasa.gov/exoplanet-catalog/trappist-1-f/) |
| TRAPPIST-1 g | TRAPPIST-1 | 半径约 1.13 个地球半径；公转约 12.4 天 | [NASA · TRAPPIST-1 g](https://science.nasa.gov/exoplanet-catalog/trappist-1-g/) |
| 开普勒-186 f | 开普勒-186 | 2014 年公布发现；半径 1.17 个地球半径；公转约 129.9 天 | [NASA · Kepler-186 f](https://science.nasa.gov/exoplanet-catalog/kepler-186-f/) |
| 开普勒-22 b | 开普勒-22 | 2011 年公布发现；半径 2.1 个地球半径；公转约 289.9 天 | [NASA · Kepler-22 b](https://science.nasa.gov/exoplanet-catalog/kepler-22b/) |

母星背景资料：

- [NASA · TRAPPIST-1](https://science.nasa.gov/exoplanets/trappist1/)：七颗地球大小行星围绕超冷红矮星运行；本次场景只开放 e、f、g，不将开放数量当成系统的总行星数。
- [NASA · 开普勒-186 系统发现](https://www.nasa.gov/news-release/nasas-kepler-telescope-discovers-first-earth-size-planet-in-habitable-zone/)：母星为 M 型红矮星，位于天鹅座方向；开普勒-186 f 是宜居带内近地球大小行星的重要发现。该 2014 年报道的旧半径估计不覆盖本次使用的目录值。
- [NASA / JPL · 开普勒-22 系统](https://www.jpl.nasa.gov/news/nasas-kepler-confirms-its-first-planet-in-habitable-zone/)：母星为 G 型、略小且略冷于太阳；开普勒-22 b 是开普勒任务首颗确认位于宜居带的行星。该 2011 年报道中的旧半径估计不覆盖本次使用的目录值。

`rocky-world`、`temperate-world`、`ice-world` 是程序化材质设计名称。岩面、冰纹、蓝色区域和云雾都是艺术示意，不能推断冰盖、海洋、宜居性或生命已经确认。每颗行星的信息面板都明确说明了相关外观的不确定性。TRAPPIST-1 e/f/g 保持由内到外的轨道顺序，每颗行星通过 `parentStarId` 与真实母星建立导航和光照关系。
