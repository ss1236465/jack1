# 代码玫瑰

本目录保存代码玫瑰原版与第二版。共享的 Three.js 脚本在 `vendor/`，背景音乐在 `media/`。

| 版本 | 线上入口 | 仓库文件 |
| --- | --- | --- |
| 原版 | http://47.117.82.118/rose/ | `index.html` |
| 第二版 | http://47.117.82.118/rose/v2/ | `v2/index.html` |

## 第二版

- 点击铁盒开场，歌曲从用户操作中开始播放，玫瑰从盒中生长。
- 使用 Web Audio Analyser 读取《半岛铁盒》的音量与低频，控制玫瑰呼吸、光晕和粒子。
- 点击花朵或爱心按钮，花瓣散成粒子爱心，再恢复成玫瑰。
- 拖动产生逐渐消散的星光轨迹。
- 长按玫瑰或点击信封，编辑情书；内容仅保存于当前浏览器的 localStorage。
- 点击保存按钮导出当前玫瑰或爱心画面为 PNG。
- 音乐按钮可暂停与恢复；进度条支持跳转，歌曲循环播放。

姓名未加入页面、画布或保存图片。

## 本地预览

在仓库根目录运行：

```sh
node server.cjs
```

打开 `http://localhost:8001/rose/v2/`。原版为 `http://localhost:8001/rose/`。

页面需要 WebGL。音乐律动在浏览器支持 Web Audio 时启用；歌曲播放需要一次点击。

## 验证

```sh
node rose/tests/interactions.cjs
node rose/tests/routes.cjs http://localhost:8001
```

交互检查运行实际页面脚本，覆盖开盒、音乐暂停与重试、长按与拖动取消、爱心恢复、重看重置和导出。HTTP 检查验证资源、原版校验值和 MP3 分段请求。渲染效果另经桌面与手机宽度预览检查。

## 部署

将本目录同步到服务器：

```text
/opt/1panel/apps/openresty/openresty/www/sites/game/index/rose/
```

`v2/` 使用 `../vendor/` 与 `../media/`，两份资源为两个版本共享。部署第二版只需新增 `v2/`，不需要覆盖原版。
