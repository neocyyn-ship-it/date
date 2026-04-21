# 女装电商经营分析工作台

基于 `Electron + React + TypeScript + Vite + Ant Design + ECharts + DuckDB + SheetJS + Zustand + dayjs` 的本地桌面经营分析应用。

## 已实现能力

- Excel 多文件导入与导入记录
- 两类模板识别：退款分析表、新品商品经营表
- 周期解析：周区间、精确区间、近 30 天、整月
- DuckDB 本地持久化
- 同周期同商品逻辑替换，新周期自动追加
- 商品图映射基础能力
- 经营总览、渠道营销、退款诊断、商品分析、导入中心、导入记录页面
- 加权退款均值、ROI、环比、商品标签分类

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

```powershell
.\pnpm.exe dev
```

## 构建

```powershell
.\pnpm.exe build
.\pnpm.exe build:win
```

## 样例验证

项目根目录已放入两份真实 Excel：

- `samples-product.xls`
- `samples-refund.xlsx`

可执行：

```powershell
.\pnpm.exe test:import -- samples-product.xls samples-refund.xlsx
```

## 说明

- DuckDB 数据文件默认创建在运行目录下的 `db/ecom_analytics.duckdb`
- 首次启动 Electron 时若缺少平台二进制，需要补跑 Electron 安装脚本
- 当前版本是可运行 MVP，字段映射编辑器与本地图片目录批量匹配已预留扩展接口
