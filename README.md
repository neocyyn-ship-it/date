# 女装电商经营分析工作台

基于 `Electron + React + TypeScript + Vite + Ant Design + ECharts + DuckDB + SheetJS + Zustand + dayjs` 的本地桌面经营分析应用。

## 已实现能力

- Excel 多文件导入与导入记录
- 两类模板识别：退款分析表、新品商品经营表
- 周期解析：周区间、精确区间、近 30 天、整月
- DuckDB 本地持久化
- 同周期同商品逻辑替换，新周期自动追加
- 商品图片映射基础能力
- 经营总览、渠道营销、退款诊断、商品分析、数据导入中心、导入记录、相关性分析
- 加权退款均值、ROI、环比、商品标签分类
- 自定义分析卡、相关性分析、自定义视图保存、首页拼板

## 当前核心口径

- 支付统一看：`生参支付金额`
- 投产统一看：`阿里妈妈花费` 与 `阿里妈妈投产比`
- 重点识别三类商品：
  - `自然流强`
  - `广告驱动`
  - `高消耗低产出`

## 工程结构

```text
src/
  main/
  preload/
  renderer/
  shared/
  backend/
```

## 本地启动

直接双击：

- `start-dev.bat`

它会自动完成：

1. 检查 Electron 运行时
2. 首次缺失时自动下载运行时
3. 构建桌面应用
4. 打开桌面窗口

如果使用命令行：

```powershell
.\start-dev.bat
```

## Windows 打包

直接双击：

- `build-win.bat`

或命令行执行：

```powershell
.\build-win.bat
```

打包结果会输出到：

```text
release/
```

## 样例数据

项目根目录放了两份样例 Excel：

- `samples-product.xls`
- `samples-refund.xlsx`

可执行：

```powershell
.\pnpm.exe test:import -- samples-product.xls samples-refund.xlsx
```

## 使用建议

1. 先进入 `数据导入中心`
2. 导入经营表和退款表
3. 如有商品图，再选择图片目录
4. 导入完成后，应用会自动切到最新周期
5. 再看 `经营总览 / 渠道营销 / 商品分析 / 退款诊断`

## 说明

- DuckDB 数据文件默认创建在 `db/ecom_analytics.duckdb`
- 首次启动如果本机没有 Electron 运行时，脚本会自动下载
- 当前版本是可运行的 MVP，后续可继续扩展字段映射中心、图片批量管理、库存/RFM/财务模块
