# ORBIT · 宇宙漫游

直接双击本目录的 **index.html** 即可使用。Three.js 和全部 13 张纹理已嵌入 HTML，无需联网、安装依赖或启动服务器。建议使用支持 WebGL 2、已开启硬件加速的新版 Chrome、Edge 或 Safari。

## 演示视频

[![ORBIT 宇宙漫游演示预览](demo-preview.jpg)](demo.mp4)

**[查看演示视频](demo.mp4)** · [下载 MP4](https://github.com/ryh842487118-bot/orbit/raw/refs/heads/main/demo.mp4)

58 秒，1440 × 900，30 FPS。实际网页录制，依次展示地球夜景、国际空间站、月球、木星、土星环、太阳系轨道与银河，最后返回地球。

## 探索

- 鼠标拖动旋转视角；滚轮缩放；触屏单指旋转、双指捏合缩放。
- 从地球持续缩小，可依次进入太阳系和银河尺度；持续放大则回到所追踪天体。
- 点击底部天体、场景中的天体或标记，可以平滑飞向目的地。
- 地球左侧提供「看万家灯火」「探访空间站」。
- 顶部提供「近地轨道」「太阳系」「银河系」快捷导航。
- 轨道、标记可以独立开关；天体运动支持暂停及 0.25×、1×、5×、20× 演示流速。
- 快捷键：`+` / `-` 缩放，空格暂停，`H` 回地球，`F` 全屏，`I` 隐藏界面，`?` 操作说明。

## 实现范围

Three.js r185；地球昼夜着色、夜景灯光、独立云层、大气边缘；32 颗卫星、简化国际空间站、月球；太阳、八大行星、土星透明环；太阳系轨道；程序生成的旋臂银河；对数深度缓冲；泛光后处理；响应式界面。

这是交互可视化，天体尺寸、距离、轨道位置与速度经过视觉调整，不是实时天文星历。卫星和空间站模型尺寸有意放大；银河是示意模型。HUD 近景距离根据视觉单位换算，适用于演示。

## 文件

- `src/shell.html`：页面和交互控件。
- `src/style.css`：界面样式与手机布局。
- `src/universe.js`：Three.js 场景、着色器与导航。
- `assets/`：原始纹理、来源和许可。
- `build.mjs`：将引擎、场景脚本和纹理打包进一个 HTML。
- `index.html`：单文件构建产物。
- `demo.mp4`：网页演示视频。
- `demo-preview.jpg`：README 视频预览图。

重新构建：先运行 `npm install`，再运行 `npm run build`。输出写入本目录的 `index.html`，所有依赖均来自本项目。

纹理来自 [Solar System Scope](https://www.solarsystemscope.com/textures/)，采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)；使用时通过实时光照和着色显示。完整清单见 `assets/CREDITS.md`。Three.js 使用 MIT 许可证，见 `assets/THREE-LICENSE.txt`。
