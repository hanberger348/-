# 新生请说不

《大一新生大战期末考试》的第一关：校园卡保卫战。竖屏、手绘火柴人风格，使用浏览器直接游玩，无需登录。

## 操作与规则

- 手机长按底部左右键；电脑使用 A/D 或左右方向键。P / Esc 暂停。
- 主角在底部左右移动，自动发射“不要、no、用不着、谢谢”。
- 学长学姐固定在上方背景板，手臂晃动并投下传单与校园卡。
- 每打掉一张得10分，被碰到一次立即结束。
- 对话框每0.52秒发射一次；投放频率与下落速度逐步提高，90秒达到上限。
- 入场昵称最多九个可见字符，支持中文。

## GitHub Pages 网页版

Pages 发布目录为 `docs/`，使用相对资源路径，支持 `<用户名>.github.io/freshman-card-defence/` 这样的项目地址。

这个版本的排行榜保存在当前浏览器，并明确标注“本机排行榜”。不同设备不会同步，清除浏览器数据会清除记录。游戏开始不依赖外部排行榜服务器。静态网页托管不保证所有地区和网络都能访问。

共享排行榜服务器的源码保留在 `worker/`，数据结构位于 `migrations/`。这些服务器程序不会在 GitHub Pages 上运行。

## 开发与更新

需要 Node.js 22.13 或更高版本。项目没有需要安装的运行依赖。

```sh
npm test
npm run build
npm start
```

预览地址由启动命令输出。修改 `public/` 中的文件后运行 `npm run build`，将更新后的源码和 `docs/` 一起提交。

仓库设置中的 Pages 选择“Deploy from a branch”，分支 `main`，目录 `/docs`。

## 文件

- `public/engine.mjs`：移动、碰撞、自动反击、投放和难度规则。
- `public/game.mjs`：画面、动画、音效和操作。
- `public/scores.mjs`：本机排行榜及浏览器存储。
- `public/style.css`：竖屏布局。
- `docs/`：发布用网页文件。
- `worker/`、`migrations/`：可单独部署的共享排行榜服务源码。

## 素材

人物、校门、校园卡和传单来自作者提供的原创手绘，原图以画面区域引用。

音乐为 TinyWorlds 的 [Happy Adventure](https://opengameart.org/content/happy-adventure-loop)，音效来自 Kenney 的 [Interface Sounds](https://kenney.nl/assets/interface-sounds)，两者为 CC0。完整来源见 `public/audio/sources.txt`，音效许可见 `public/audio/kenney-license.txt`。
