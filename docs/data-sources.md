# EarthSense 数据来源与契约

EarthSense **1.4.0** 只注册 **天气、闪电、台风** 三个图层，默认全部开启，可独立开关；它们将公开天气／风暴数据与明确标记的闪电演示叠加在 ORBIT 原有地球表面。数据适配器位于 `src/data/`，图层与请求状态位于 `src/earthsense/`；数据模块不依赖 Three.js 或页面 UI。

地表隐藏天气／闪电定位符号及台风中心符号，可点击云团、台风云带或事件列表查看详情。晴天没有云团时，通过列表选择对应天气采样点。选中台风后仍显示可点击的历史／预测路径时间点。

## 公开接口

| 来源与图层 | 接口 | 读取内容 |
| --- | --- | --- |
| [Open-Meteo 官方文档](https://open-meteo.com/en/docs)：天气 | [/v1/forecast](https://api.open-meteo.com/v1/forecast?latitude=31.23&longitude=121.47&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&timezone=GMT&timeformat=unixtime&forecast_days=1&cell_selection=nearest) | 多坐标批量返回的 `current`；单位使用接口默认值。链接为单点请求示例，应用实际批量请求 60 点。 |
| [NASA EONET v3 文档](https://eonet.gsfc.nasa.gov/docs/v3)：风暴 | [/api/v3/events?status=open&category=severeStorms&limit=100](https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=severeStorms&limit=100) | 读取最多 100 项未关闭风暴的 `events` 及其按时间记录的 `geometry`。 |
| [GDACS 官方 API 文档](https://www.gdacs.org/gdacsapi/swagger/index.html)：台风预警 | [geteventlist/MAP?eventtype=TC](https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype=TC) | `FeatureCollection` 中的事件中心、报告等级、来源最大风速及轨迹线段。 |
| GDACS：选中台风的公告 | [getepisodedata 示例](https://www.gdacs.org/gdacsapi/api/events/getepisodedata?eventtype=TC&eventid=1001317&episodeid=18) | 按所选 `eventid` 与 `episodeid` 读取公告，使用 `properties.impacts[].resource.timeline` 中发布的路径链接。 |
| GDACS：官方历史与预测 | [gettimeline 示例](https://www.gdacs.org/gdacsapi/api/export/gettimeline?id=793141) | `channel.item[]` 中每点的 `actual`、`current`、公告编号、坐标、风速和 UTC 有效时间。链接中的内部 ID 从该次公告读取，不硬编码。 |

天气请求使用 `timezone=GMT&timeformat=unixtime&cell_selection=nearest`。字段为 `temperature_2m`、`relative_humidity_2m`、`precipitation`、`rain`、`weather_code`、`cloud_cover`、`wind_speed_10m`、`wind_direction_10m`。

## 统一事件格式

列表网络调用为 `loadWeather(options)`、`loadEonet('severeStorms', options)`、`loadGdacs('TC', options)`。选中台风时调用 `src/data/cyclone-track.js` 的 `loadCycloneTrack(event, options)`，返回该次公告的路径。`options` 支持 `signal`、`force` 和用于测试的 `fetchImpl`；传输或格式失败抛出错误。闪电通过本地 `loadSimulatedLightning()` 返回演示记录，不发起数据请求。

```js
{
  id, layer, title,
  lat, lon,                 // WGS84；纬度 [-90, 90]，经度 [-180, 180]
  time,                     // 来源事件时间，UTC ISO 字符串
  source, sourceUrl,         // 来源名称；仅允许 HTTPS 详情链接
  severity,                 // high / medium / low / unknown
  description,
  metrics: [{ label, value }],
  track: [[lon, lat], ...],  // 可选：EONET 按时间排序的连续观测路径
  paths: [[[lon, lat], ...], ...], // 可选：旧 GDACS 独立线段，不据此判断历史／预测
  cyclone: {                // 仅台风／风暴；缺失风速为 null
    windSpeedKmh,
    windBasis,              // observation / event-maximum / unavailable
    validTime               // 当前观测的 UTC ISO 时间；事件最大值为 null
  },
  gdacs: { eventId, episodeId, eventType, source }, // GDACS 公告标识
  trackData: {              // EONET 自带历史；GDACS 选中后按需加载
    history: [{ lon, lat, time, validTime, windSpeedKmh, source, sourceUrl }],
    forecast: [{ lon, lat, time, validTime, windSpeedKmh, source, sourceUrl }],
    current,                // GDACS 明确标为当前的观测点，否则 null
    source, sourceUrl, dataUrl, issuedAt,
    status,                 // ready / history-only / unavailable
    message
  },
  weather: {                // 仅天气事件；缺失观测值保留为 null
    temperature, windSpeed, windDirection,
    precipitation, cloudCover, interval,
    rain, humidity, code
  }
}
```

无效坐标、时间或不适用几何会被过滤；同一来源 ID 的重复记录保留较新记录。顶层格式错误、HTTP 错误、非法 JSON 和请求超时均不会伪装成空事件数组。标题和说明属于外部文本，UI 使用 `textContent` 渲染，不将来源内容当作 HTML。

`severity` 用于预警标签分级：GDACS 使用当前报告的 `episodealertlevel`，卡片同时保留事件总体 `alertlevel`。EONET 未提供相应等级时为 `unknown`。台风云系的半径与旋速读取独立的 `cyclone.windSpeedKmh`，不使用预警颜色推算风速。

## 时间、单位与覆盖范围

- **天气**：纬度为 −60°、−30°、0°、30°、60°，每条纬线每 30° 经度采样一次，共 60 点；它们是当前天气模型估计，**不是连续全球气象场或地面气象站实测值**。风向是来向，单位为度；风速为 km/h，气温为 °C，云量和湿度为百分比。
- **累计降水与雨率**：Open-Meteo `current.time` 为 Unix 秒，`current.interval` 为累计时间间隔的秒数。`precipitation` 包含雨、阵雨和雪的降水量，`rain` 为降雨量，单位均为 mm。卡片保留真实累计间隔，例如“近 15 分钟”。视觉效果取有效 `rain` / `precipitation` 的较大值，以 `累计 mm × 3600 / interval` 换算为 mm/h；例如 15 分钟累计 1 mm 对应 4 mm/h。缺失或无效间隔不补造雨率，只可按天气代码做定性雨线示意；雪类代码不生成雨线。
- **EONET 风暴**：最多读取 100 项来源标记为 `open` 的 `severeStorms` 事件。它是经过整理的事件目录，未关闭不表示刚刚发生，也不保证覆盖全部风暴。时间取最新有效 `geometry.date`，不替换成当前时间。Point 直接定位，Polygon 使用球面平均的示意中心并在说明中标明。风暴历史 Point 按时间排序生成路径；`magnitudeValue` 的 `kts` 按 1.852 换算为 km/h。EONET 未提供官方预测端点，返回 `history-only` 并明确说明；正常空集合表示本次来源没有匹配事件。
- **GDACS**：只将 `Point_Centroid` 计为事件；风圈、多边形、预报锥和轨迹不计为新增灾害。`todate` 表示来源事件／报告结束时间，`datemodified` 用于区分修订；这些未带时区的来源时间按 UTC 处理。台风同时读取 EONET 风暴；名称匹配的重复事件优先保留 GDACS，因此并非两个来源数量的简单相加。
- **独立闪电图层**：保留 6 个明确标注的模拟雷暴地点，`simulated: true`、`time: null`，来源显示“模拟数据”，默认开启。`loadSimulatedLightning()` 是后续接入真实闪电服务的替换入口；这些地点的云团、雨线和闪电不表示当地实际发生雷暴。

UI 的“更新”时间是本次成功取得数据的时间，事件卡片时间来自数据源，两者含义不同。宇宙演示流速不会改写事件时间。图层用于探索与科普，采样位置、路径和分级不能替代官方监测、避险信息或应急决策；数据使用仍需遵循各来源的许可与调用配额。

## 台风公告与路径

GDACS 列表的 `severitydata.severity` 是**事件最大风速**，其单位按来源字段转换；初始云系据此缩放，并使用 `windBasis: 'event-maximum'` 与 `validTime: null` 明确区分当前观测。选中台风后，适配器请求列表指向的具体公告，检查返回的事件与公告编号一致，再读取该公告发布的官方 timeline 链接。只接受 GDACS HTTPS `gettimeline` 地址，不把几何轮廓或预报锥猜测为中心路径。

timeline 的 `actual: 'True'` 是历史观测，`actual: 'False'` 是官方预测；`current: 'true'` 与 `actual: 'True'` 同时成立才是当前观测。`advisory_datetime` 按 `DD Mon YYYY HH:mm` 解析为 UTC，保留为每个点的 `time` / `validTime`。当前观测时间存入该次路径的 `issuedAt`，UI 标为“预报时次”；该字段不是网页发布时间，`datemodified` 也不替代它。只展示匹配当前公告编号、有效时间晚于该观测的官方预测点。缺少明确当前观测或公告编号时保留历史、隐藏预测并说明原因，不能把旧公告预测混入当前路径。时间分类来自公告字段，不随本机当前时间改变；UI 可单独标示公告预测时段已结束。

timeline 的持续风速 `wind_speed` 单位为 m/s，乘 3.6 换算为 km/h；已与 [GDACS 官方 MARIE 公告的 km/h 图表](https://www.gdacs.org/Cyclones/report.aspx?eventid=1001317&episodeid=18&eventtype=TC) 逐点核对。只有上述明确当前观测的风速可在选中后更新云系，预测风速仅显示在预测点详情中。无效数值、负值或未知单位保留为空，不能用缺测值生成风力。

地球上只显示当前选中的台风路径：历史用实线，预测用虚线，两类来源时间点分别可点击。没有官方预测时仅显示可用历史，不延长观测轨迹；没有可用路径时显示 `unavailable`。已实测 NOAA 的 MARIE 公告返回 18 个历史点与 8 个预测点，JTWC 的 KROVANH 公告返回 18 与 7 个点；样本公告及采集日期见 [fixture 溯源记录](../tests/fixtures/README.md)。

## 天气与台风的视觉含义

天气云使用贴合球面的半透明薄云片，每个有云采样点的三片几何合并渲染；扭曲噪声生成缓慢流动的云丝与渐散边缘，太阳方向控制昼夜明暗，雷暴脉冲短暂照亮云内。云形、漂移和局部覆盖范围是程序示意，不能据此推断未采样区域的连续云场。

天气云渲染器初始化时生成一张 256 × 256 的单通道噪声纹理（64 KiB），供该组云片共享采样，减少逐片元重复的噪声计算；它是程序纹理，不是新增气象数据或卫星底图。

`src/earthsense/effects/weather-state.js` 将真实天气采样记录转换为局部示意效果：晴／大致晴朗代码 `0 / 1` 不生成云、雨或闪电，即使其他字段存在冲突；其余天气的云量控制云团密度，雨率连续控制雨线数量、速度、长度与扩散范围。雨率强度采用平滑映射并在 50 mm/h 达到动画上限。**天气图层仅在 Open-Meteo 代码为 `95`、`96`、`99` 时显示雷暴闪电**；普通降雨或较高云量不会被升级为雷暴。雷暴示意闪电的循环间隔随雨率增强从约 18 秒缩短到 4 秒，亮度也随之变化；这个节奏不是来源实测闪电频率，API 没有提供逐次落雷数据。

台风云系定位于 EONET / GDACS 的真实事件经纬度。`effects/cyclone-scale.js` 将来源 km/h 连续映射到视觉半径和旋转速度；当前映射在 280 km/h 达到视觉上限，缺测值使用明确的中性示意大小。两层曲面薄云形成低眼墙、开放风眼与长短宽窄不同的螺旋云带，结构随事件种子变化，云带细节与整体旋转采用不同的流动节奏；南北半球旋向相反。局部云内电光是程序演示，强弱和频率均不代表来源观测。**风速驱动的示意半径仍不是卫星云边界或官方风圈／预测锥**。独立闪电图层复用天气效果渲染器，但始终保留上述 6 个点的模拟身份。

## 地球高清底图

地球日夜底图来自 [Solar System Scope 官方纹理](https://www.solarsystemscope.com/textures/)，采用 CC BY 4.0；原始 8K 文件的来源、尺寸与校验值见 [素材署名](../assets/CREDITS.md) 和 [manifest](../assets/manifest.json)。它们是静态视觉重建纹理，不是当前卫星观测；天气数据与灾害时间由独立公开接口提供。

`src/earth/detail-textures.js` 在应用启动后异步准备同一对 **8192 × 4096** 源图，供宇宙漫游与感知模式共用：桌面优先 8K，手机布局或设备报告内存不高于 4 GB 时优先 4K，最终尺寸还受 GPU 纹理上限限制。4K 是运行时降采样结果，并非另一个官方下载版本；原文件不做重采样或覆盖。无法使用高于 2K 的纹理或加载失败时继续使用原 2K 底图。两模式共用细分地球几何、原有昼夜着色、原泛光及同一渲染采样策略，切换不会降级贴图或重新调亮地球。

固定装饰云层只在宇宙漫游中显示；感知模式在地球近景关闭它，仅显示数据驱动的局部天气／台风云系。因此晴天采样点不会被固定装饰云层覆盖。两种云形都不代表实时卫星云图。

## 缓存、取消和错误状态

`src/data/http.js` 合并同 URL 的并发请求，成功且通过格式验证后才缓存，列表与台风公告／路径接口的 TTL 均为 15 分钟。60 个天气采样点使用一次批量请求。单次请求超时为 18 秒，接口选项 `force` 绕过有效缓存。

只有 EarthSense 模式开启且图层启用时才调度该图层。调度器每分钟检查是否到期，页面隐藏时跳过自动轮询；退出模式或关闭图层取消相应请求。取消一个消费者不会中止仍被其他图层使用的共享请求，最后一个消费者取消时才中止底层请求。模式退出后保留已成功取得的数据与开关状态；GPU 叠加图层仅在地球视角进入近景后显示。

台风路径由独立选择状态管理，缓存键包含事件 ID、公告编号与事件时间。更换所选事件、关闭详情、关闭对应图层、离开地球近景或切换模式时取消该次路径请求并清除所选路径；迟到的旧响应不能重新打开详情或覆盖新选择。路径加载期间使用 `loading`，网络失败显示 `error`；二者是 UI 状态，与来源明确的 `history-only` / `unavailable` 不混淆。

| 状态 | 含义 |
| --- | --- |
| `idle` / `loading` | 尚未读取 / 正在读取，刷新期间可继续保留已有事件效果。 |
| `ready` / `empty` | 成功取得有效事件 / 来源成功返回且没有可显示事件。 |
| `partial` | 台风的 GDACS / EONET 部分来源失败；展示此次成功来源的数据，同时显示失败来源说明。 |
| `error` | 首次读取失败，尚无可复用的成功结果。 |
| `stale` | 刷新失败，保留上次成功的数据与更新时间，明确提示未能更新。 |

失败及部分失败在约一分钟后重试。请求取消不被当作来源故障；普通错误不会触发伪造灾害或静态“实时”数据回退。

## 静态部署与验证

`npm run build` 仍生成包含 Three.js、代码、CSS 与 15 张纹理的自包含 `index.html`，其中包括两张原始 8K 地球图。高清底图本身不需要额外联网下载。宇宙漫游保持离线可用，EarthSense 的公开数据需要联网；无需服务端代理、API 密钥或额外地球引擎。直接通过 `file://` 打开和 GitHub Pages 静态部署均使用浏览器 CORS 请求。

列表接口在 2026-09-06 UTC 实测返回 `Access-Control-Allow-Origin: *`，包含 `Origin: null` 与 GitHub Pages 来源测试；新增 GDACS NOAA / JTWC 公告与 timeline 请求同日实测 HTTP 200，均带该 CORS 响应头。所有请求使用 `credentials: 'omit'`，无需账号或代理。GDACS 应使用表中的 `/gdacsapi/api/events/geteventlist/MAP`；另一个 `/xml/gdacsTC.geojson` 地址实测缺少 CORS 响应头，未用于应用。来源将来更改 CORS 或服务不可用时，页面会显示相应数据错误，宇宙渲染仍可继续。

`node --test tests/data.test.js tests/cyclone-data.test.js` 使用 `tests/fixtures/` 内注明采集日期的真实小型响应，覆盖单位、空数据、错误格式、UTC 日期、坐标、来源链接、事件去重、官方预测与当前公告匹配、缺少当前观测、缓存、超时和取消。Fixtures 仅用于测试，不会打包为运行时实况数据。

历史版本的风场、地震、火山、山火和洪水模块及其适配器／测试源码暂时保留；当前 `layers.js` 不注册这些图层，不请求相应数据。未被当前入口引用的独立模块不进入构建依赖图，测试中保留旧类别不表示产品仍开放这些图层。
