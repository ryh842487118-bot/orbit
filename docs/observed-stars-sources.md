# 新增已观测恒星资料

核查日期：2026-09-12。对应 `src/universe/observed-stars.js`。

本批加入 8 颗真实、已观测的银河系恒星。`modelStatus: confirmed` 表示天体存在得到观测确认；三维星面、颜色、尺寸和坐标为探索画面设计，不是望远镜照片或真实尺度星图。北极星与心宿二明确展示主要恒星成员，不把多星系统误作一颗恒星。巴纳德星需要借助望远镜观察。

| 天体 | 本次采用的事实 | 核查主源 |
| --- | --- | --- |
| 北极星 A / Polaris Aa | 小熊座；北天极附近；三星系统主要成员；造父变星。不同观测方法给出的历史距离有分歧，本次以类型作为第一统计项。 | [ESO：Probing Polaris](https://www.eso.org/public/blog/probing-polaris/)、[NASA Hubble：Polaris 的伴星](https://science.nasa.gov/asset/hubble/hubble-images-polariss-companion/) |
| 牛郎星 / Altair | 天鹰座；蓝白主序星；约 17 光年；夏季大三角成员；快速自转使赤道鼓起，干涉观测可解析形状。画面球形模型仍为简化示意。 | [NASA：Summer Triangle Corner — Altair](https://science.nasa.gov/solar-system/skywatching/night-sky-network/summer-triangle-corner-altair/)、[NASA：Stars of a Summer Triangle](https://apod.nasa.gov/apod/ap150627.html) |
| 大角星 / Arcturus | 牧夫座红巨星；距离约 37 光年；橙色外观；可沿北斗斗柄弧线寻找。 | [NASA：恒星类型](https://science.nasa.gov/universe/stars/types/)、[ESA Hipparcos：亮星目录](https://www.cosmos.esa.int/web/hipparcos/brightest)、[NASA：2024 年 11 月观天说明](https://science.nasa.gov/solar-system/skywatching/the-next-full-moon-will-be-the-last-of-four-consecutive-supermoons/) |
| 毕宿五 / Aldebaran | 金牛座红巨星；约 65 光年；位于毕星团的前景，并非星团成员。 | [NASA / JPL：红巨星观测卡](https://nightsky.jpl.nasa.gov/documents/787/ObserverCardsRed1.pdf)、[ESA Hipparcos：亮星目录](https://www.cosmos.esa.int/web/hipparcos/brightest)、[NASA / JPL：金牛座的眼睛](https://solarsystem.nasa.gov/rails/active_storage/blobs/redirect/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBBaUJoIiwiZXhwIjpudWxsLCJwdXIiOiJibG9iX2lkIn19--e2656a2331f6fd7e164c29507db8599dce197c1c/JPL-20190201-WHATSUf-0001-Transcript.pdf?disposition=inline) |
| 天津四 / Deneb | 天鹅座蓝白超巨星；夏季大三角成员；标记天鹅的尾部。距离在不同公开资料中存在差异，第一统计项采用恒星类型。 | [NASA / JPL：2021 年 10 月观天指南](https://www.jpl.nasa.gov/videos/whats-up-october-2021/)、[NASA：Summer Triangle Corner — Deneb](https://science.nasa.gov/solar-system/skywatching/night-sky-network/summer-triangle-corner-deneb/) |
| 南船二 / Canopus | 船底座亮星；水手 7 号锁定它、配合太阳作为姿态参考。不在本批中采用距离或精细光谱类型。 | [NASA / JPL：水手 7 号锁定 Canopus](https://www.jpl.nasa.gov/news/mariner-7-to-complete-star-acquisition-sequence/)、[ESA Hipparcos：亮星目录（α Car）](https://www.cosmos.esa.int/web/hipparcos/brightest)、[IAU：Canopus 的中天轨迹](https://iauarchive.eso.org/public/videos/detail/ann22042d/) |
| 心宿二 A / Antares A | 天蝎座红超巨星；ESO VLTI 对其星面和大气速度场进行了观测。以恒星类型作为第一统计项；不用未经本次主源核实的距离。 | [ESO：心宿二星面与大气](https://www.eso.org/public/news/eso1726/)、[IAU：恒星名称与成员标识](https://iauarchive.eso.org/public/themes/naming_stars/) |
| 巴纳德星 / Barnard’s Star | 蛇夫座红矮星；约 6 光年；望远镜观测目标。不写可能随新观测变化的行星数量或排名。 | [ESO：巴纳德星与行星观测](https://www.eso.org/public/news/eso2414/)、[ESO：蛇夫座内巴纳德星位置](https://www.eso.org/public/images/eso1837c/) |

场景坐标均位于以 `[-18000, 0, 0]` 为中心、半径 30000 的银河探索范围内，并与已有恒星目的地拉开距离。`r` 仅用于近看和相机导航，不能拿来换算物理半径；统计栏的距离以光年明示。
